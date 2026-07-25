'use strict';

/**
 * install.js — Register GuardianDesk Agent as a Windows Service
 *
 * MUST be run from an ELEVATED (Administrator) command prompt.
 * Run once during initial setup on the child's PC:
 *
 *   node install.js
 *
 * What this does
 * ──────────────
 * 1. If no device credentials exist, triggers the pairing flow interactively.
 * 2. Registers agent.js as a persistent Windows Service named "GuardianDeskAgent".
 * 3. Configures the service to:
 *    - Start automatically on system boot (StartType = Automatic)
 *    - Restart automatically on crash/failure (service recovery settings)
 * 4. Starts the service immediately.
 *
 * node-windows
 * ────────────
 * node-windows wraps the NSSM (Non-Sucking Service Manager) approach and
 * generates a small .exe wrapper in %ProgramFiles%\guardiandesk-agent that
 * the Windows Service Control Manager (SCM) manages like any native service.
 * The service runs as SYSTEM by default, which gives it the elevated rights
 * needed for taskkill and netsh commands.
 */

const path       = require('path');
const { exec }   = require('child_process');
const { Service } = require('node-windows');

const tokenStore  = require('./lib/tokenStore');
const { pairDevice } = require('./lib/pairing');

// ---------------------------------------------------------------------------
// Run the pairing flow if no credentials are stored yet
// ---------------------------------------------------------------------------

async function ensurePaired() {
  const existing = tokenStore.loadToken();
  if (existing) {
    console.log(`[install] Device already paired (device_id: ${existing.deviceId}). Skipping pairing.`);
    return;
  }

  console.log('[install] No credentials found. Starting pairing flow before service install…');
  await pairDevice();
}

// ---------------------------------------------------------------------------
// Configure Service Recovery via `sc.exe failure`
//
// node-windows does not expose service recovery settings directly, so we use
// the built-in Windows `sc.exe` command after the service is installed.
//
// sc failure <service> reset=<seconds> actions=<action/delay,...>
//
//   reset=3600       — reset the failure count after 1 hour of clean uptime
//   actions=restart/5000/restart/10000/restart/30000
//                    — on 1st failure: restart after 5 s
//                    — on 2nd failure: restart after 10 s
//                    — on 3rd+ failure: restart after 30 s
// ---------------------------------------------------------------------------

function configureServiceRecovery() {
  return new Promise((resolve, reject) => {
    const cmd =
      'sc failure GuardianDeskAgent reset=3600 ' +
      'actions=restart/5000/restart/10000/restart/30000';

    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        // Non-fatal — service is already installed and running; recovery is
        // a "nice to have" on top.  Log the warning but don't abort.
        console.warn(`[install] Could not set recovery options: ${stderr || err.message}`);
        console.warn('[install] You can set them manually in services.msc → Recovery tab.');
        resolve();
      } else {
        console.log('[install] Service recovery configured (restart on failure).');
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Main install
// ---------------------------------------------------------------------------

async function install() {
  // Step 1: pair if needed
  await ensurePaired();

  // Step 2: create the service descriptor
  const svc = new Service({
    name:        'GuardianDeskAgent',
    description: 'GuardianDesk parental control background agent. ' +
                 'Monitors app usage and enforces parental rules on this device.',

    // Absolute path to the main agent script
    script: path.join(__dirname, 'agent.js'),

    // node-windows uses the SYSTEM account by default (required for
    // elevated taskkill / netsh operations). Do not change this unless
    // you configure the chosen account with the necessary privileges.

    // Environment variables injected into the service process at runtime.
    // All three Supabase keys must be set as system env vars before install.
    env: [
      { name: 'SUPABASE_URL',         value: process.env.SUPABASE_URL         || '' },
      { name: 'SUPABASE_ANON_KEY',    value: process.env.SUPABASE_ANON_KEY    || '' },
      // Service key used ONLY for Realtime WebSocket (bypasses RLS on apps table)
      { name: 'SUPABASE_SERVICE_KEY', value: process.env.SUPABASE_SERVICE_KEY || '' },
    ],
  });

  // Step 3: wire up events
  svc.on('install', () => {
    console.log('[install] Windows Service installed successfully.');

    // Start the service immediately after install
    svc.start();
  });

  svc.on('start', () => {
    console.log('[install] GuardianDeskAgent service started.');
    console.log('[install] The agent is now running in the background.');
    console.log('[install] You can verify it in services.msc or Task Manager → Services.');

    // Step 4: configure failure/recovery after the service is registered
    configureServiceRecovery();
  });

  svc.on('error', (err) => {
    console.error('[install] Service error:', err);
  });

  svc.on('alreadyinstalled', () => {
    console.log('[install] Service is already installed. Starting it…');
    svc.start();
  });

  // Step 5: install (triggers 'install' event above)
  svc.install();
}

install().catch((err) => {
  console.error('[install] Fatal error:', err);
  process.exit(1);
});
