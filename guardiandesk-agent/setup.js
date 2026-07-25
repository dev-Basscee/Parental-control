'use strict';

/**
 * setup.js — GuardianDesk Interactive Setup Entry Point
 *
 * WHY setup.js AND agent.js ARE SEPARATE FILES
 * ─────────────────────────────────────────────
 * There are two completely different execution contexts in this project:
 *
 *   1. setup.js  — runs ONCE, interactively, in a console window.
 *      The parent double-clicks the .exe (or runs `node setup.js`).
 *      It has a visible terminal, can print to stdout, and can read stdin
 *      for the pairing code.  After setup completes, the parent closes
 *      the window and never needs to touch this file again.
 *
 *   2. agent.js  — runs FOREVER, headlessly, as a Windows Service.
 *      Windows Services have no console attached.  Writing to stdout goes
 *      nowhere; reading from stdin would hang forever.  Therefore agent.js
 *      NEVER prompts for input and NEVER assumes there is a visible console.
 *      It writes to a log file instead.
 *
 * Keeping them separate prevents the most common mistake: embedding
 * readline prompts or console.log messages inside shared modules that
 * get imported by both — which would cause the service to hang or crash.
 *
 * EXECUTION ORDER
 * ───────────────
 * STEP A — Check if already paired
 *   If device.dat exists and decrypts successfully → skip to STEP C (idempotent).
 *
 * STEP B — Pairing
 *   Prompt for 6-digit code → call pair-device edge function → save token.
 *   Verify the save by re-reading and decrypting (don't trust in-memory state).
 *   Any failure here → print clear error and exit(1). Nothing is installed yet.
 *
 * STEP C — Install + start the Windows Service
 *   Only reached when a verified token exists on disk.
 *   Registers agent.js as a persistent Windows Service.
 *   Configures auto-restart on crash (via sc.exe failure command).
 *   Starts the service immediately.
 */

const path     = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const util     = require('util');

const { Service }        = require('node-windows');
const tokenStore         = require('./lib/tokenStore');
const { pairDevice }     = require('./lib/pairing');
const { configWarnings } = require('./config');

const execAsync = util.promisify(exec);

// ---------------------------------------------------------------------------
// Console helpers (only used here — never imported by agent.js)
// ---------------------------------------------------------------------------

function println(msg)       { process.stdout.write(msg + '\n'); }
function printOk(msg)       { println(`  \u2705 ${msg}`); }            // ✅
function printErr(msg)      { process.stderr.write(`  \u274C ${msg}\n`); }  // ❌
function printWarn(msg)     { println(`  \u26A0\uFE0F  ${msg}`); }     // ⚠️
function printStep(n, msg)  { println(`\n[${n}] ${msg}`); }

function printBanner() {
  println('');
  println('╔══════════════════════════════════════════════════════╗');
  println('║         GuardianDesk Agent — Setup Wizard            ║');
  println('╚══════════════════════════════════════════════════════╝');
  println('');
}

/**
 * Read one line of input from stdin.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
function readLine(prompt) {
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Configure Windows Service failure/recovery via sc.exe.
 *
 * sc failure <name> reset=<secs> actions=<action/delay,...>
 *   reset=3600           — reset failure count after 1 h of clean uptime
 *   actions=restart/5000/restart/10000/restart/30000
 *                        — restart after 5 s, 10 s, 30 s on successive crashes
 *
 * This is a best-effort call — if it fails the service still runs; we just
 * won't have automatic restart configured via the SCM.
 */
async function configureServiceRecovery() {
  const cmd =
    'sc failure GuardianDeskAgent reset=3600 ' +
    'actions=restart/5000/restart/10000/restart/30000';
  try {
    await execAsync(cmd, { windowsHide: true });
    printOk('Service auto-restart on crash configured.');
  } catch (err) {
    printWarn(`Could not configure auto-restart: ${err.message}`);
    printWarn('Set it manually: services.msc → GuardianDeskAgent → Recovery tab.');
  }
}

// ---------------------------------------------------------------------------
// STEP C — Install Windows Service
// ---------------------------------------------------------------------------

/**
 * Registers agent.js as the "GuardianDeskAgent" Windows Service and starts it.
 *
 * Only called after a verified token exists on disk.
 * The service runs agent.js directly — NOT setup.js — because agent.js is the
 * headless runtime loop, not the interactive installer.
 *
 * @returns {Promise<void>}
 */
function installAndStartService() {
  return new Promise((resolve, reject) => {
    const svc = new Service({
      name:        'GuardianDeskAgent',
      description: 'GuardianDesk parental control background agent. ' +
                   'Enforces rules set by the parent dashboard on this device.',

      // IMPORTANT: the service must point to agent.js, not setup.js.
      // setup.js is interactive (readline, console output).
      // agent.js is headless and writes to a log file.
      script: path.join(__dirname, 'agent.js'),

      // Inject environment variables into the service process at runtime.
      // These are read by config.js via dotenv / process.env.
      env: [
        { name: 'SUPABASE_URL',         value: process.env.SUPABASE_URL         || '' },
        { name: 'SUPABASE_ANON_KEY',    value: process.env.SUPABASE_ANON_KEY    || '' },
        // SERVICE_KEY is required for reliable Realtime; warn if missing.
        { name: 'SUPABASE_SERVICE_KEY', value: process.env.SUPABASE_SERVICE_KEY || '' },
      ],

      // node-windows runs the service as SYSTEM by default, which grants the
      // elevated rights needed for taskkill on protected processes and netsh
      // firewall rule management.  Do not change this unless you explicitly
      // grant an alternate account SeDebugPrivilege + firewall admin rights.
    });

    svc.on('install', () => {
      printOk('Windows Service registered.');
      svc.start();
    });

    svc.on('start', async () => {
      printOk('GuardianDeskAgent service started.');
      await configureServiceRecovery();
      println('');
      println('╔══════════════════════════════════════════════════════╗');
      println('║  ✅  GuardianDesk is now running in the background.  ║');
      println('║      You can safely close this window.               ║');
      println('╚══════════════════════════════════════════════════════╝');
      println('');
      println('  The agent will start automatically every time this PC boots.');
      println('  Check the parent dashboard to confirm this device is online.');
      println('');
      resolve();
    });

    svc.on('alreadyinstalled', () => {
      // Service already registered — just make sure it's running
      printOk('Service is already installed.');
      println('  Ensuring it is started...');
      svc.start();
    });

    svc.on('error', (err) => {
      reject(new Error(`Service installation error: ${err}`));
    });

    svc.install();
  });
}

// ---------------------------------------------------------------------------
// Main setup flow
// ---------------------------------------------------------------------------

async function main() {
  printBanner();

  // Surface any deferred config warnings to the console now that we have one.
  for (const warning of configWarnings) {
    printWarn(warning);
  }

  // ── STEP A: Check for an existing valid token ────────────────────────────
  printStep('1', 'Checking for existing device credentials...');
  const existing = tokenStore.loadToken();

  if (existing) {
    printOk(`This device is already paired (device_id: ${existing.deviceId})`);
    println('  Skipping pairing — proceeding to service installation.');

    // Even if already paired, re-run the service install so this exe is
    // safe to double-click again if the service was accidentally stopped.
    printStep('2', 'Installing / verifying Windows Service...');
    await installAndStartService();
    return;
  }

  println('  No credentials found — starting first-time pairing.');

  // ── STEP B: Pairing ──────────────────────────────────────────────────────
  printStep('2', 'Device Pairing');
  println('');
  println('  On the PARENT device, open the GuardianDesk dashboard,');
  println('  go to  Devices → Pair New Device  and copy the 6-digit code.');
  println('');

  let code;
  // Allow up to 3 attempts before aborting — a parent might mistype the code.
  for (let attempt = 1; attempt <= 3; attempt++) {
    code = await readLine(`  Enter 6-digit pairing code (attempt ${attempt}/3): `);

    if (/^\d{6}$/.test(code)) break;

    printErr('Code must be exactly 6 digits (e.g. 482093). Try again.');
    if (attempt === 3) {
      printErr('Too many invalid attempts. Please re-run setup with a fresh code.');
      process.exit(1);
    }
    code = null;
  }

  println('');
  println('  Contacting GuardianDesk server...');

  let deviceId, deviceToken;
  try {
    ({ deviceId, deviceToken } = await pairDevice(code));
  } catch (err) {
    printErr(`Pairing failed: ${err.message}`);
    println('');
    println('  Common causes:');
    println('    • The code has expired (codes are valid for 15 minutes).');
    println('    • The code was already used — generate a new one in the dashboard.');
    println('    • No internet connection on this PC.');
    println('');
    println('  Re-run this setup after getting a fresh code from the dashboard.');
    process.exit(1);
  }

  // ── Save credentials to disk ─────────────────────────────────────────────
  println('  Saving encrypted credentials to disk...');
  try {
    tokenStore.saveToken(deviceId, deviceToken);
  } catch (err) {
    printErr(`Failed to save credentials: ${err.message}`);
    printErr('Make sure this program is running as Administrator.');
    process.exit(1);
  }

  // ── STEP B-VERIFY: Re-read the file to confirm the write worked ──────────
  // We do NOT trust the in-memory values.  The whole point is that agent.js
  // will read from disk on every startup — if the file is unreadable, the
  // agent is broken.  Verify now, while we still have a console to report it.
  printStep('3', 'Verifying saved credentials...');
  const verified = tokenStore.loadToken();

  if (!verified || verified.deviceId !== deviceId) {
    printErr('Credential verification failed — the file was written but cannot be read back.');
    printErr('This could be a permissions issue or a disk error.');
    printErr('Device pairing was successful on the server, but the agent cannot start.');
    printErr('Try re-running setup as Administrator. If the problem persists, contact support.');
    process.exit(1);
  }

  printOk('Credentials saved and verified successfully.');

  // ── STEP C: Install the Windows Service ──────────────────────────────────
  printStep('4', 'Installing Windows Service...');
  println('  (This requires Administrator privileges)');

  try {
    await installAndStartService();
  } catch (err) {
    printErr(`Service installation failed: ${err.message}`);
    printErr('Make sure you are running this as Administrator.');
    printErr('The device IS paired — you can re-run setup to retry service installation.');
    process.exit(1);
  }
}

// Top-level error boundary
main().catch((err) => {
  printErr(`Unexpected error: ${err.message}`);
  process.exit(1);
});
