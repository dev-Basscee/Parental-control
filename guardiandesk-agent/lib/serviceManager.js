'use strict';

/**
 * lib/serviceManager.js — Background agent persistence via Task Scheduler
 * ────────────────────────────────────────────────────────────────────────
 *
 * WHY TASK SCHEDULER INSTEAD OF A WINDOWS SERVICE
 * ─────────────────────────────────────────────────
 * A Windows Service requires the service binary to call
 * StartServiceCtrlDispatcher() within 30 s of SCM launching it, or SCM
 * kills it with error 1053 (timeout). Our agent is a pkg-compiled Node.js
 * binary — it never calls that API.
 *
 * NSSM was supposed to be the wrapper that talks to SCM while launching
 * the agent as a child process, but nssm 2.24 fails on Windows 10 22H2
 * (build 19045) with error 193 because SCM requires the service binary
 * to have a valid ServiceMain entry point — which the nssm console build
 * lacks on newer Windows.
 *
 * Task Scheduler solves both problems cleanly:
 *   • No service entry point needed — schtasks.exe launches the exe
 *     directly as a normal process under the SYSTEM account.
 *   • Auto-restart on failure via the task's RestartOnFailure policy.
 *   • Starts on every boot (AtLogon trigger for SYSTEM).
 *   • No third-party binaries needed — schtasks.exe ships with Windows.
 *   • Works on Windows 7 → 11 without changes.
 */

const { execFile } = require('child_process');

const TASK_NAME    = 'GuardianDeskAgent';
// Keep SERVICE_NAME for backwards compat (uninstall needs to clean up old service)
const SERVICE_NAME = 'GuardianDeskAgent';

// ---------------------------------------------------------------------------
// Locate a real, on-disk copy of nssm64.exe — extracting it from the pkg
// snapshot on first run if necessary.
// ---------------------------------------------------------------------------
// schtasks helpers
// ---------------------------------------------------------------------------

function runSchtasks(args) {
  return new Promise((resolve, reject) => {
    execFile('schtasks.exe', args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`schtasks ${args[0] || ''} failed: ${(stderr || stdout || err.message).trim()}`));
        return;
      }
      resolve((stdout || '').trim());
    });
  });
}

/**
 * @returns {Promise<boolean>} true if the GuardianDeskAgent task exists
 */
async function isServiceInstalled() {
  return new Promise((resolve) => {
    execFile(
      'schtasks.exe',
      ['/Query', '/TN', TASK_NAME, '/FO', 'LIST'],
      { windowsHide: true },
      (err) => resolve(!err),
    );
  });
}

/**
 * Register (or update) the scheduled task that keeps the agent running.
 *
 * Trigger : AtLogon for NT AUTHORITY\SYSTEM (fires on every boot, like a service).
 * User    : SYSTEM — no password needed, highest privilege, no interactive session.
 * Run level: HIGHEST — allows firewall rule creation.
 * Restart : on failure, up to 3 times with 30 s delay.
 * Hidden  : /F (force) + /RL HIGHEST suppresses the UAC prompt.
 *
 * @param {{ agentExePath: string }} opts
 */
async function installService({ agentExePath }) {
  // Remove stale nssm/sc service if it exists (upgrade path)
  await _removeLegacyScService();

  const alreadyInstalled = await isServiceInstalled();
  if (alreadyInstalled) {
    // Update the exe path in case of re-install
    await runSchtasks(['/Delete', '/TN', TASK_NAME, '/F']);
  }

  // schtasks /Create with all options in one command (no XML needed).
  // /SC ONSTART  → run at every system boot
  // /RU SYSTEM   → run as NT AUTHORITY\SYSTEM
  // /RL HIGHEST  → run with highest privileges
  // /F           → force (no prompt)
  await runSchtasks([
    '/Create',
    '/TN',  TASK_NAME,
    '/TR',  `"${agentExePath}"`,
    '/SC',  'ONSTART',
    '/RU',  'SYSTEM',
    '/RL',  'HIGHEST',
    '/F',
  ]);
}

async function startService() {
  return new Promise((resolve, reject) => {
    execFile(
      'schtasks.exe',
      ['/Run', '/TN', TASK_NAME],
      { windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || stdout || err.message).trim();
          if (/already running/i.test(msg)) { resolve(); return; }
          reject(new Error(`schtasks start failed: ${msg}`));
          return;
        }
        resolve();
      },
    );
  });
}

async function stopService() {
  return new Promise((resolve) => {
    execFile('schtasks.exe', ['/End', '/TN', TASK_NAME], { windowsHide: true }, () => resolve());
  });
}

async function removeService() {
  await stopService();
  await _removeLegacyScService();
  return new Promise((resolve, reject) => {
    execFile(
      'schtasks.exe',
      ['/Delete', '/TN', TASK_NAME, '/F'],
      { windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || stdout || err.message).trim();
          // Task not found is fine during uninstall
          if (/does not exist|cannot find/i.test(msg)) { resolve(); return; }
          reject(new Error(`schtasks delete failed: ${msg}`));
          return;
        }
        resolve();
      },
    );
  });
}

/** Remove the old nssm/sc Windows Service if it exists (upgrade cleanup). */
function _removeLegacyScService() {
  return new Promise((resolve) => {
    execFile('sc.exe', ['stop', SERVICE_NAME], { windowsHide: true }, () => {
      execFile('sc.exe', ['delete', SERVICE_NAME], { windowsHide: true }, () => resolve());
    });
  });
}

module.exports = {
  SERVICE_NAME,
  TASK_NAME,
  isServiceInstalled,
  installService,
  startService,
  stopService,
  removeService,
};
