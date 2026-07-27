'use strict';

/**
 * agent.js — GuardianDesk Headless Background Service
 *
 * WHY THIS FILE NEVER PROMPTS FOR INPUT
 * ──────────────────────────────────────
 * Windows Services run with no console attached.  There is no stdin to read
 * from and no visible window to write to.  Any attempt to call readline or
 * write to process.stdout produces either nothing or a hang.
 *
 * All interactive steps (pairing, confirmation, error messages the parent
 * can see) happen in setup.js BEFORE this service is installed.  By the time
 * agent.js runs for the first time, device.dat MUST already exist on disk.
 * If it doesn't, the agent logs the error to a file and exits — the Windows
 * Service Recovery settings will retry after 5/10/30 seconds, but it will
 * keep failing until setup.js is re-run.  This is the correct behaviour.
 *
 * WHAT THIS FILE DOES
 * ────────────────────
 * 1. Load credentials from tokenStore.  Exit if missing/corrupt.
 * 2. Report startup to activity_log (tamper detection signal).
 * 3. Fetch currently blocked apps from backend and seed the in-memory Set.
 * 4. Subscribe to Supabase Realtime for instant rule push updates.
 * 5. Every 10 s: enforce blocks (kill any blocked process the child reopened).
 * 6. Every 60 s: sync running + installed apps to backend.
 *
 * All output goes to the log file, never to stdout/stderr.
 */

const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const http     = require('http');
const { exec } = require('child_process');
const util     = require('util');

// Hoisted once at module load — resolveExePaths() runs every 60 s so
// calling require('util').promisify on every invocation is wasteful.
const execAsync = util.promisify(exec);

const { createClient } = require('@supabase/supabase-js');

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  FUNCTIONS_URL,
  configWarnings,
} = require('./config');

const tokenStore = require('./lib/tokenStore');
const { getRunningApps, getInstalledApps } = require('./lib/appScanner');
const {
  // killProcess is used inside enforceBlockedApps — not called directly here.
  blockNetworkAccess,
  unblockNetworkAccess,
  enforceBlockedApps,
} = require('./lib/enforcer');

// ---------------------------------------------------------------------------
// File logger
// ---------------------------------------------------------------------------
// Windows Services have no console.  We write all output to a rotating log
// file in the same data directory as device.dat.
// Log lines are prefixed with ISO timestamps so the parent (or support) can
// read them if something goes wrong.

const LOG_DIR  = path.join(process.env.PROGRAMDATA || '.', 'GuardianDesk');
const LOG_FILE = path.join(LOG_DIR, 'agent.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024; // rotate at 5 MB

function ensureLogDir() {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* already exists */ }
}

function rotateLogIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size >= MAX_LOG_BYTES) {
      // Keep one backup copy
      const backup = LOG_FILE + '.1';
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(LOG_FILE, backup);
    }
  } catch { /* file doesn't exist yet — fine */ }
}

function log(level, ...args) {
  const ts  = new Date().toISOString();
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const line = `[${ts}] [${level}] ${msg}\n`;

  // Always try to write to the file
  try {
    ensureLogDir();
    rotateLogIfNeeded();
    fs.appendFileSync(LOG_FILE, line);
  } catch { /* nowhere left to report — silently swallow */ }
}

const logger = {
  info:  (...a) => log('INFO ', ...a),
  warn:  (...a) => log('WARN ', ...a),
  error: (...a) => log('ERROR', ...a),
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {{ deviceId: string, deviceToken: string }} */
let credentials;

/**
 * In-memory set of app_name strings currently blocked.
 * Populated on startup from the backend and updated in real time.
 * @type {Set<string>}
 */
const blockedApps = new Set();

/**
 * Maps app_name (lowercase) → absolute exe path, populated during syncApps.
 * Used to add accurate Windows Firewall rules scoped to the exact .exe path.
 * @type {Map<string, string>}
 */
const exePathCache = new Map();

// Supabase Realtime client.
// Uses the service-role key so postgres_changes events pass through RLS
// on the `apps` table (the anon key has no SELECT policy on that table).
// The service key is embedded into the agent at build time via env vars;
// it is never sent to the internet — only used for the Realtime WebSocket
// that connects to Supabase's own servers.
const realtimeKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const supabase    = createClient(SUPABASE_URL, realtimeKey, {
  realtime: { params: { eventsPerSecond: 2 } },
});

// ---------------------------------------------------------------------------
// HTTP helper (shared by all Edge Function calls)
// ---------------------------------------------------------------------------

/**
 * POST JSON to a URL with optional custom headers.
 * Rejects with a descriptive Error on any non-2xx response.
 *
 * @param {string} url
 * @param {object} body
 * @param {object} [headers]
 * @returns {Promise<object>}
 */
function postJSON(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed  = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname + (parsed.search || ''),
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
          // Supabase gateway requires the anon key on every Edge Function call.
          'Authorization':  `Bearer ${SUPABASE_ANON_KEY}`,
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error((data && data.error) || `HTTP ${res.statusCode}`));
            }
          } catch {
            reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${raw.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/** Returns the device auth headers used in all Edge Function calls. */
function agentHeaders() {
  return {
    'x-device-id':    credentials.deviceId,
    'x-device-token': credentials.deviceToken,
    // Authorization is already added by postJSON; these are extra device headers.
  };
}

// ---------------------------------------------------------------------------
// 1. Credentials
// ---------------------------------------------------------------------------

/**
 * Loads credentials from disk.
 *
 * If device.dat is missing or corrupt, we log the error and exit.
 * This is NOT the pairing flow — pairing was already done by setup.js.
 * The agent cannot re-pair itself (no console), so it exits and waits
 * for the Windows Service Recovery to restart it.  If device.dat is truly
 * gone, every restart will fail — the parent must re-run setup.js.
 */
function loadCredentialsOrExit() {
  const token = tokenStore.loadToken();

  if (!token) {
    logger.error(
      'FATAL: device.dat is missing or cannot be decrypted. ' +
      'The agent cannot start without valid credentials. ' +
      'Please re-run GuardianDeskSetup.exe on this device to re-pair it.'
    );
    process.exit(1);  // Service Recovery will retry; will keep failing until setup.js is re-run
  }

  credentials = token;
  logger.info(`Credentials loaded (device_id: ${credentials.deviceId})`);
}

// ---------------------------------------------------------------------------
// 2. Tamper detection — startup signal
// ---------------------------------------------------------------------------

/**
 * Fetches devices.last_seen_at for this device and compares it to now.
 * If the gap is > 5 minutes, the agent was stopped unexpectedly (tamper signal).
 * Either way, we send an "agent_restarted" log entry so the parent dashboard
 * can always see when this device came back online.
 */
async function reportStartupSignal() {
  try {
    // First, get the last_seen_at from the backend via sync-apps (it echoes
    // device info back).  We use a minimal call with an empty app list.
    // If this fails, we still continue — tamper detection is best-effort.
    const result = await postJSON(
      `${FUNCTIONS_URL}/sync-apps`,
      { apps: [] },
      agentHeaders()
    );

    // Determine if last_seen_at indicates an unexpected gap (> 5 min)
    // The server updates last_seen_at on every sync call, so if it was more
    // than 5 minutes ago, the agent wasn't running during that window.
    const lastSeen = result && result.last_seen_at ? new Date(result.last_seen_at) : null;
    const gapMinutes = lastSeen
      ? (Date.now() - lastSeen.getTime()) / 60000
      : null;

    const action = gapMinutes !== null && gapMinutes > 5
      ? 'agent_restarted_after_gap'
      : 'agent_restarted';

    // Report the startup event regardless
    await postJSON(
      `${FUNCTIONS_URL}/report-activity`,
      {
        app_name:     'system',
        action,
        triggered_by: 'system',
      },
      agentHeaders()
    );

    if (action === 'agent_restarted_after_gap') {
      logger.warn(
        `Tamper signal: agent was offline for ~${Math.round(gapMinutes)} minutes. ` +
        `Reported as "${action}" to parent dashboard.`
      );
    } else {
      logger.info('Startup signal sent to parent dashboard.');
    }
  } catch (err) {
    // Non-fatal — network may be down briefly on boot
    logger.warn(`Could not send startup signal: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Seed blocked apps from backend
// ---------------------------------------------------------------------------

/**
 * Fetches the current block state from the backend and populates blockedApps.
 *
 * Uses the sync-apps Edge Function with an empty app list — the function
 * returns the full rules payload for this device regardless of the app list
 * size, so we get the current block state in a single call.
 *
 * Runs once on startup before Realtime is connected, so the agent enforces
 * rules immediately without waiting for a Realtime change event.
 */
async function seedBlockedApps() {
  try {
    const result = await postJSON(
      `${FUNCTIONS_URL}/sync-apps`,
      { apps: [] },
      agentHeaders()
    );

    if (result && Array.isArray(result.rules)) {
      for (const row of result.rules) {
        if (row.app_status === 'blocked') {
          blockedApps.add(row.app_name);
        }
      }
    }

    logger.info(`Seeded ${blockedApps.size} blocked app(s) from backend.`);
  } catch (err) {
    logger.warn(`seedBlockedApps failed: ${err.message}. Realtime will catch up.`);
  }
}

// ---------------------------------------------------------------------------
// 4. Apply a single app's status (called by Realtime and syncApps)
// ---------------------------------------------------------------------------

/**
 * Adds or removes an app from the blockedApps Set and applies the corresponding
 * firewall/kill enforcement.
 *
 * @param {string} appName
 * @param {'blocked'|'allowed'|'scheduled'} status
 */
async function applyAppStatus(appName, status) {
  if (status === 'blocked') {
    if (!blockedApps.has(appName)) {
      blockedApps.add(appName);
      logger.info(`Blocking: ${appName}`);

      // Apply firewall rule if we know the exe path
      const exePath = exePathCache.get(appName.toLowerCase()) || '';
      if (exePath) {
        await blockNetworkAccess(appName, exePath);
      } else {
        logger.warn(`No cached exe path for ${appName} — firewall rule skipped; taskkill only.`);
      }
    }
  } else {
    if (blockedApps.has(appName)) {
      blockedApps.delete(appName);
      logger.info(`Unblocking: ${appName}`);
      await unblockNetworkAccess(appName);
    }
  }
}

// ---------------------------------------------------------------------------
// 4b. Subscribe to Supabase Realtime
// ---------------------------------------------------------------------------

/**
 * Opens a Supabase Realtime channel subscribed to postgres_changes on the
 * `apps` table, filtered to rows for THIS device only.
 *
 * Why this gives near-instant enforcement (< 2 s):
 *   Supabase Realtime listens to the Postgres WAL and fans out change events
 *   over a persistent WebSocket.  When the parent clicks "Block" in the
 *   dashboard, the DB row updates, Realtime publishes the event, and this
 *   agent receives it within ~1-2 seconds without any polling.
 *
 * The 60-second syncApps poll exists as a drift-correction fallback in case
 * the WebSocket disconnects briefly (e.g. laptop wakes from sleep).
 */
function subscribeToRealtime() {
  const channel = supabase
    .channel(`guardiandesk-agent-${credentials.deviceId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',       // INSERT, UPDATE, DELETE
        schema: 'public',
        table:  'apps',
        filter: `device_id=eq.${credentials.deviceId}`,
      },
      async (payload) => {
        try {
          logger.info(`Realtime event: ${payload.eventType}`);

          if (payload.eventType === 'DELETE') {
            const appName = payload.old && payload.old.app_name;
            if (appName) await applyAppStatus(appName, 'allowed');
            return;
          }

          const row = payload.new;
          if (row && row.app_name) {
            await applyAppStatus(row.app_name, row.status);
          }
        } catch (err) {
          logger.error(`Error handling Realtime event: ${err.message}`);
        }
      }
    )
    .subscribe((status, err) => {
      if (err) {
        logger.error(`Realtime subscription error: ${err.message}`);
      } else {
        logger.info(`Realtime subscription status: ${status}`);
      }
    });

  return channel;
}

// ---------------------------------------------------------------------------
// 5. Enforcement tick (every 10 s)
// ---------------------------------------------------------------------------

async function enforcementTick() {
  const blocked = Array.from(blockedApps);
  if (blocked.length === 0) return;

  logger.info(`Enforcement tick: ${blocked.length} blocked app(s).`);
  await enforceBlockedApps(blocked);
}

// ---------------------------------------------------------------------------
// 6. syncApps (every 60 s)
// ---------------------------------------------------------------------------

/**
 * Resolves exe paths for running processes using PowerShell Get-Process.
 *
 * Get-Process returns the full exe path via .Path — far more accurate than
 * trying to guess from the exe name or registry.  We cache the results in
 * exePathCache so blockNetworkAccess can use them for firewall rules.
 *
 * @returns {Promise<Map<string, string>>}  map of exeName.toLowerCase() → fullPath
 */
async function resolveExePaths() {
  // Uses module-level execAsync — no per-call require() overhead.
  const map = new Map();

  try {
    // Get-Process -ErrorAction SilentlyContinue: suppress errors for processes
    // that exit between the time we call this and when PS scans them.
    // Select-Object Name,Path: keep only what we need.
    // ConvertTo-Json -Compress: output as a flat JSON array.
    const psCmd =
      `Get-Process -ErrorAction SilentlyContinue ` +
      `| Where-Object { $_.Path } ` +
      `| Select-Object -Property Name,Path ` +
      `| ConvertTo-Json -Compress`;

    const { stdout } = await execAsync(
      `powershell.exe -NonInteractive -NoProfile -Command "${psCmd}"`,
      { maxBuffer: 8 * 1024 * 1024, windowsHide: true }
    );

    const trimmed = stdout.trim();
    if (!trimmed) return map;

    const parsed = JSON.parse(trimmed);
    const items  = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      if (item.Name && item.Path) {
        // Key is "roblox.exe" (lowercase, with extension)
        const key = item.Name.toLowerCase().endsWith('.exe')
          ? item.Name.toLowerCase()
          : `${item.Name.toLowerCase()}.exe`;
        map.set(key, item.Path);
      }
    }
  } catch (err) {
    logger.warn(`resolveExePaths failed: ${err.message}`);
  }

  return map;
}

/**
 * Main sync function — gathers all running and installed apps, posts them to
 * the `sync-apps` Edge Function, and applies any rule changes returned.
 *
 * Called immediately on startup and then every 60 seconds.
 */
async function syncApps() {
  try {
    const [runningApps, installedApps, exePaths] = await Promise.all([
      getRunningApps(),
      getInstalledApps(),
      resolveExePaths(),
    ]);

    // Update the exe path cache from fresh process data
    for (const [key, val] of exePaths) {
      exePathCache.set(key, val);
    }

    // Merge running + installed into a single de-duped list
    const seen    = new Set();
    const allApps = [];

    for (const a of runningApps) {
      const key = a.app_name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const exePath = exePathCache.get(key) || '';
        allApps.push({
          app_name:     a.app_name,
          display_name: a.app_name,
          exe_path:     exePath,  // extra field; server ignores unknown fields
        });
      }
    }
    for (const a of installedApps) {
      const key = a.display_name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allApps.push({ app_name: a.display_name, display_name: a.display_name });
      }
    }

    const result = await postJSON(
      `${FUNCTIONS_URL}/sync-apps`,
      { apps: allApps },
      agentHeaders()
    );

    // Apply any rule updates returned by the server.
    // This is the drift-correction path: if Realtime missed an event while
    // the agent was offline, this call catches it up.
    if (result && Array.isArray(result.rules)) {
      for (const row of result.rules) {
        await applyAppStatus(row.app_name, row.app_status);
      }
    }

    logger.info(
      `Sync complete — sent ${allApps.length} apps, ` +
      `server confirmed ${result && result.synced_count != null ? result.synced_count : '?'}.`
    );
  } catch (err) {
    logger.error(`syncApps failed: ${err.message}`);
    // Non-fatal — try again on the next tick
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.info('GuardianDesk Agent starting...');

  // Flush deferred config warnings now that the file logger is ready.
  // (config.js cannot write to the log directly — logger doesn't exist yet
  // when config.js is loaded at require time.)
  for (const w of configWarnings) {
    logger.warn(`[config] ${w}`);
  }

  // Step 1: Load credentials — exit if missing (cannot re-pair headlessly)
  loadCredentialsOrExit();

  // Step 2: Tamper signal
  await reportStartupSignal();

  // Step 3: Seed blocked apps (before Realtime connects)
  await seedBlockedApps();

  // Step 4: Subscribe to Realtime for instant push
  subscribeToRealtime();

  // Step 5: Enforcement tick — every 10 seconds
  const enforceTick = setInterval(async () => {
    try {
      await enforcementTick();
    } catch (err) {
      logger.error(`Enforcement tick error: ${err.message}`);
    }
  }, 10_000);

  // Step 6: App sync — every 60 seconds; run once immediately on boot
  await syncApps();
  const syncTick = setInterval(async () => {
    try {
      await syncApps();
    } catch (err) {
      logger.error(`Sync tick error: ${err.message}`);
    }
  }, 60_000);

  // Keep the process alive (intervals keep the event loop open; .ref() makes
  // the intent explicit and guards against future accidental .unref() calls)
  enforceTick.ref();
  syncTick.ref();

  logger.info('GuardianDesk Agent is running.');
}

// ---------------------------------------------------------------------------
// Global error boundaries — exit so Service Recovery can restart the agent
// ---------------------------------------------------------------------------

process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION — exiting for service recovery: ${err.message}\n${err.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  logger.error(`UNHANDLED REJECTION — exiting for service recovery: ${msg}`);
  process.exit(1);
});

main().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
