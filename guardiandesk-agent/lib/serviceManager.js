'use strict';

/**
 * lib/serviceManager.js — Windows Service management via NSSM
 * ─────────────────────────────────────────────────────────────
 *
 * WHY THIS EXISTS (replacing node-windows)
 * ──────────────────────────────────────────
 * node-windows registers a service whose real entry point is its own
 * `wrapper.js`, which starts your target with `child_process.fork()`.
 * `fork()` always loads its target as a Node.js *module* — it hands the
 * path to Node's CommonJS loader. That works fine when the target is a
 * plain `.js` file, but our target is `guardiandesk-agent.exe`, a
 * standalone pkg-compiled binary with no JS to parse. Node's module
 * loader chokes on the raw PE binary bytes with a SyntaxError, and the
 * service crash-loops forever without ever actually running the agent.
 *
 * NSSM (the Non-Sucking Service Manager) does not have this problem: it
 * is a native Windows Service shim built specifically to run *arbitrary*
 * executables as services — it talks to the Service Control Manager
 * itself and simply launches the given .exe as a monitored child
 * process, restarting it if it exits unexpectedly. That is exactly the
 * shape of guardiandesk-agent.exe (a long-running console binary), so
 * nssm is the correct tool here instead of node-windows.
 *
 * nssm64.exe is vendored at guardiandesk-agent/vendor/nssm64.exe
 * (MIT-licensed, from https://nssm.cc — obtained via the `winser` npm
 * package's bundled binaries). It is bundled into the pkg snapshot as an
 * asset (see package.json → pkg.assets) and extracted to a real path on
 * disk the first time setup.js runs, because pkg assets live in a
 * virtual snapshot filesystem and cannot be spawned as child processes
 * directly — only real files on disk can be.
 */

const fs   = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const SERVICE_NAME = 'GuardianDeskAgent';

// ---------------------------------------------------------------------------
// Locate a real, on-disk copy of nssm64.exe — extracting it from the pkg
// snapshot on first run if necessary.
// ---------------------------------------------------------------------------

function resolveNssmPath() {
  if (typeof process.pkg !== 'undefined') {
    // Inside a pkg snapshot: the bundled asset is readable via fs (pkg
    // patches fs to serve snapshot paths) but NOT spawnable directly.
    // Extract it once to a real path next to the exe on disk.
    const snapshotPath = path.join(__dirname, '..', 'vendor', 'nssm64.exe');
    const realDir      = path.dirname(process.execPath);
    const realPath     = path.join(realDir, 'nssm64.exe');

    if (!fs.existsSync(realPath)) {
      const bytes = fs.readFileSync(snapshotPath);
      fs.writeFileSync(realPath, bytes);
    }
    return realPath;
  }

  // Running from source (`node setup.js`) — vendor file is already real.
  return path.join(__dirname, '..', 'vendor', 'nssm64.exe');
}

function runNssm(args) {
  return new Promise((resolve, reject) => {
    execFile(resolveNssmPath(), args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`nssm ${args[0]} failed: ${(stderr || err.message).trim()}`));
        return;
      }
      resolve((stdout || '').trim());
    });
  });
}

/**
 * @returns {Promise<boolean>} true if GuardianDeskAgent is already registered
 */
async function isServiceInstalled() {
  try {
    // "nssm status <name>" fails (non-zero exit) if the service doesn't exist.
    await runNssm(['status', SERVICE_NAME]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install (or re-point) the GuardianDeskAgent service to run agentExePath,
 * configure auto-restart on crash, and set required environment variables.
 *
 * @param {Object} opts
 * @param {string} opts.agentExePath   Absolute path to guardiandesk-agent.exe
 * @param {Object<string,string>} opts.env  Environment variables to inject
 */
async function installService({ agentExePath, env }) {
  const alreadyInstalled = await isServiceInstalled();

  if (!alreadyInstalled) {
    // "nssm install <name> <exe>" — non-interactive because both args given.
    await runNssm(['install', SERVICE_NAME, agentExePath]);
  } else {
    // Re-point an existing registration at the (possibly updated) exe path —
    // makes setup idempotent, matching the old node-windows behaviour.
    await runNssm(['set', SERVICE_NAME, 'Application', agentExePath]);
  }

  await runNssm(['set', SERVICE_NAME, 'AppDirectory', path.dirname(agentExePath)]);
  await runNssm(['set', SERVICE_NAME, 'DisplayName', 'GuardianDeskAgent']);
  await runNssm(['set', SERVICE_NAME, 'Description',
    'GuardianDesk parental control background agent. ' +
    'Enforces rules set by the parent dashboard on this device.']);
  await runNssm(['set', SERVICE_NAME, 'Start', 'SERVICE_AUTO_START']);

  // Auto-restart on crash. nssm doesn't support node-windows' tiered
  // 5s/10s/30s backoff, but a flat delay achieves the same practical goal:
  // the service comes back on its own after a crash.
  await runNssm(['set', SERVICE_NAME, 'AppExit', 'Default', 'Restart']);
  await runNssm(['set', SERVICE_NAME, 'AppRestartDelay', '5000']);

  // Environment variables — passed as separate argv entries so execFile
  // (no shell) handles any special characters in the Supabase keys safely.
  const envPairs = Object.entries(env || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`);
  if (envPairs.length > 0) {
    await runNssm(['set', SERVICE_NAME, 'AppEnvironmentExtra', ...envPairs]);
  }
}

async function startService() {
  try {
    await runNssm(['start', SERVICE_NAME]);
  } catch (err) {
    // "already running" isn't an error condition for our purposes.
    if (!/already running/i.test(err.message)) throw err;
  }
}

async function stopService() {
  try {
    await runNssm(['stop', SERVICE_NAME]);
  } catch {
    // Not running / not installed — fine during uninstall.
  }
}

async function removeService() {
  await stopService();
  try {
    // "confirm" suppresses nssm's interactive y/n prompt.
    await runNssm(['remove', SERVICE_NAME, 'confirm']);
  } catch (err) {
    if (!/service.*(not exist|doesn't exist)/i.test(err.message)) throw err;
  }
}

module.exports = {
  SERVICE_NAME,
  resolveNssmPath,
  isServiceInstalled,
  installService,
  startService,
  stopService,
  removeService,
};
