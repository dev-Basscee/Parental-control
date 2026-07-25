'use strict';

/**
 * uninstall.js — Remove the GuardianDesk Windows Service
 *
 * MUST be run from an ELEVATED (Administrator) command prompt:
 *
 *   node uninstall.js
 *
 * What this does (in order)
 * ──────────────────────────
 * 1. Stops and unregisters the "GuardianDeskAgent" Windows Service.
 * 2. Removes ALL firewall rules whose name starts with "GuardianDesk_Block_".
 * 3. Deletes %PROGRAMDATA%\GuardianDesk\device.dat (stored credentials).
 * 4. Deletes %PROGRAMDATA%\GuardianDesk\agent.log and agent.log.1 (log files).
 * 5. Removes the %PROGRAMDATA%\GuardianDesk\ directory if now empty.
 *
 * After this runs the machine is in a clean state — no trace of the agent
 * remains in Services, the Firewall, or the filesystem.
 */

const path     = require('path');
const fs       = require('fs');
const { Service } = require('node-windows');

const { removeAllGuardianDeskFirewallRules } = require('./lib/enforcer');
const { deleteToken, TOKEN_FILE }            = require('./lib/tokenStore');

// ---------------------------------------------------------------------------
// Main uninstall
// ---------------------------------------------------------------------------

async function uninstall() {
  console.log('[uninstall] Starting GuardianDesk cleanup…\n');

  // Step 1: Stop and unregister the Windows Service
  // The service script path must match what was registered in setup.js.
  const svc = new Service({
    name:   'GuardianDeskAgent',
    script: path.join(__dirname, 'agent.js'),
  });

  await new Promise((resolve) => {
    svc.on('uninstall', () => {
      console.log('[uninstall] ✓ Windows Service removed.');
      resolve();
    });

    svc.on('error', (err) => {
      // Non-fatal — continue cleanup even if the service wasn't registered
      console.warn(`[uninstall] Service removal warning: ${err}`);
      resolve();
    });

    svc.on('alreadyuninstalled', () => {
      console.log('[uninstall] Service was not installed (already removed or never set up).');
      resolve();
    });

    svc.uninstall();
  });

  // Step 2: Remove all GuardianDesk_Block_* Windows Firewall rules
  console.log('[uninstall] Removing firewall rules…');
  await removeAllGuardianDeskFirewallRules();
  console.log('[uninstall] ✓ Firewall rules removed.');

  // Step 3: Delete the encrypted credentials file
  console.log('[uninstall] Deleting stored credentials…');
  deleteToken();  // no-op if file doesn't exist
  console.log('[uninstall] ✓ Credentials deleted.');

  // Step 4: Delete log files
  // agent.log is written by agent.js (the headless service) to the same
  // data directory.  We delete it and the single backup (agent.log.1).
  const dataDir = path.dirname(TOKEN_FILE);  // %PROGRAMDATA%\GuardianDesk
  const logFiles = [
    path.join(dataDir, 'agent.log'),
    path.join(dataDir, 'agent.log.1'),
  ];
  for (const f of logFiles) {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
        console.log(`[uninstall] ✓ Deleted log file: ${f}`);
      }
    } catch (err) {
      console.warn(`[uninstall] Could not delete ${f}: ${err.message}`);
    }
  }

  // Step 5: Remove the GuardianDesk data directory if it is now empty
  try {
    const remaining = fs.readdirSync(dataDir);
    if (remaining.length === 0) {
      fs.rmdirSync(dataDir);
      console.log(`[uninstall] ✓ Data directory removed: ${dataDir}`);
    } else {
      console.log(
        `[uninstall] Data directory still contains files — leaving it: ${dataDir}`
      );
    }
  } catch {
    // Directory may have already been removed or may never have existed
  }

  console.log('\n[uninstall] ✓ GuardianDesk Agent has been completely removed.');
  console.log('[uninstall] To re-install, run setup.js (as Administrator).\n');
}

uninstall().catch((err) => {
  console.error('[uninstall] Fatal error during cleanup:', err);
  process.exit(1);
});
