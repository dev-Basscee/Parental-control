'use strict';

/**
 * lib/enforcer.js
 *
 * Enforces app blocks on the Windows machine using two complementary
 * mechanisms:
 *
 *   1. Windows Firewall outbound block rule (preferred)
 *      Stops the app's network connectivity without repeatedly crashing it.
 *      This is less jarring than taskkill and harder for a child to work around
 *      (requires admin rights to remove a firewall rule).
 *
 *   2. taskkill (fallback / belt-and-suspenders)
 *      Terminates the process if it is already running.
 *      Used on each enforcement tick so that an app reopened between ticks
 *      gets killed again quickly.
 *
 * All shell commands used here are native Windows tools; no third-party
 * dependencies are needed.
 */

const { exec } = require('child_process');
const util     = require('util');

const execAsync = util.promisify(exec);

// Prefix applied to every firewall rule name so uninstall can clean them all
// with a single wildcard query.
const RULE_PREFIX = 'GuardianDesk_Block_';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalises an application name to end with ".exe".
 * tasklist and taskkill both expect the raw executable filename.
 *
 * @param {string} name   e.g. "Roblox" or "Roblox.exe"
 * @returns {string}      e.g. "Roblox.exe"
 */
function normaliseExeName(name) {
  const lower = name.trim().toLowerCase();
  return lower.endsWith('.exe') ? name.trim() : `${name.trim()}.exe`;
}

/**
 * Builds the firewall rule name for an app, matching the RULE_PREFIX convention.
 *
 * @param {string} appName   e.g. "Roblox.exe"
 * @returns {string}         e.g. "GuardianDesk_Block_Roblox.exe"
 */
function ruleName(appName) {
  return `${RULE_PREFIX}${normaliseExeName(appName)}`;
}

// ---------------------------------------------------------------------------
// killProcess
// ---------------------------------------------------------------------------

/**
 * Terminates all running instances of a process by executable name.
 *
 * Command: taskkill /IM "<name>.exe" /F
 *
 *   /IM   — Image name (exe filename) to target
 *   /F    — Force termination (equivalent to SIGKILL; does not give the
 *           process a chance to save data)
 *
 * Exit code 128 means "process not found" — that is expected and is silently
 * swallowed.  Any other non-zero exit code is logged but not re-thrown, because
 * a failure to kill one process should not stop the enforcement loop.
 *
 * Note: killing processes owned by SYSTEM or services with protected-process
 * light (PPL) status requires SeDebugPrivilege.  The agent must run as SYSTEM
 * (which node-windows does by default) to kill stubborn processes.
 *
 * @param {string} appName   e.g. "Roblox.exe" or "Roblox"
 */
async function killProcess(appName) {
  const exeName = normaliseExeName(appName);
  try {
    await execAsync(`taskkill /IM "${exeName}" /F`, { windowsHide: true });
  } catch {
    // Exit code 128 = "not running" — expected; no console (headless-safe)
  }
}

// ---------------------------------------------------------------------------
// blockNetworkAccess
// ---------------------------------------------------------------------------

/**
 * Adds an outbound Windows Firewall rule that blocks all network traffic from
 * a specific executable.
 *
 * Command: netsh advfirewall firewall add rule
 *   name="GuardianDesk_Block_<appName>"
 *   dir=out
 *   program="<exePath>"
 *   action=block
 *
 * Parameters:
 *   name      — Unique rule identifier (GuardianDesk_Block_ prefix for easy cleanup)
 *   dir=out   — Outbound traffic only; blocking outbound is sufficient to
 *               prevent online play / content loading without crashing the app
 *               immediately when launched (less disruptive than taskkill)
 *   program   — Absolute path to the .exe; firewall rules scoped to a path
 *               are more precise than rules scoped to just a port or protocol
 *   action=block — Drop the packets silently
 *
 * Requires: the agent process must be running as Administrator or SYSTEM.
 *           node-windows services run as SYSTEM by default.
 *
 * If a rule with the same name already exists, netsh returns a non-zero exit
 * code which we silently swallow (idempotent add).
 *
 * @param {string} appName   e.g. "Roblox.exe"
 * @param {string} exePath   Absolute path, e.g. "C:\Users\Leo\AppData\Roblox\Roblox.exe"
 */
async function blockNetworkAccess(appName, exePath) {
  const name = ruleName(appName);
  const cmd  =
    `netsh advfirewall firewall add rule ` +
    `name="${name}" dir=out program="${exePath}" action=block`;

  try {
    await execAsync(cmd, { windowsHide: true });
  } catch {
    // Rule already exists = non-zero exit but harmless; no console (headless-safe)
  }
}

// ---------------------------------------------------------------------------
// unblockNetworkAccess
// ---------------------------------------------------------------------------

/**
 * Removes the outbound firewall block rule for an application.
 *
 * Command: netsh advfirewall firewall delete rule name="<ruleName>"
 *
 * If the rule doesn't exist (was never added, or already removed) netsh
 * returns a non-zero exit code which is silently swallowed.
 *
 * @param {string} appName   e.g. "Roblox.exe"
 */
async function unblockNetworkAccess(appName) {
  const name = ruleName(appName);
  const cmd  = `netsh advfirewall firewall delete rule name="${name}"`;

  try {
    await execAsync(cmd, { windowsHide: true });
  } catch {
    // "No rules match" or already removed — harmless; no console (headless-safe)
  }
}

// ---------------------------------------------------------------------------
// removeAllGuardianDeskFirewallRules
// ---------------------------------------------------------------------------

/**
 * Removes ALL firewall rules whose name starts with the RULE_PREFIX.
 * Called by uninstall.js during agent removal.
 *
 * Command: netsh advfirewall firewall delete rule name="GuardianDesk_Block_*"
 *
 * The wildcard syntax is supported by netsh for rule deletion.
 */
async function removeAllGuardianDeskFirewallRules() {
  const cmd = `netsh advfirewall firewall delete rule name="${RULE_PREFIX}*"`;
  try {
    await execAsync(cmd, { windowsHide: true });
  } catch {
    // "No rules match" is fine — nothing to clean up; no console (headless-safe)
  }
}

// ---------------------------------------------------------------------------
// enforceBlockedApps
// ---------------------------------------------------------------------------

/**
 * Main enforcement function called on every 10-second tick.
 *
 * For each blocked app name:
 *   - Calls killProcess() so that any instance the child just reopened is
 *     terminated immediately.
 *
 * The firewall rule is NOT re-added here on every tick because:
 *   a) It was added once when the block status was first received from Realtime.
 *   b) Re-running netsh every 10 seconds is noisy and slow.
 *   c) Firewall rules survive reboots — the Windows Service also auto-starts,
 *      so the firewall rule will already be in place.
 *
 * @param {string[]} blockedAppNames   Array of exe names to enforce
 */
async function enforceBlockedApps(blockedAppNames) {
  if (!blockedAppNames || blockedAppNames.length === 0) return;

  // Run all kills in parallel for speed
  await Promise.allSettled(
    blockedAppNames.map((name) => killProcess(name))
  );
}

module.exports = {
  killProcess,
  blockNetworkAccess,
  unblockNetworkAccess,
  removeAllGuardianDeskFirewallRules,
  enforceBlockedApps,
};
