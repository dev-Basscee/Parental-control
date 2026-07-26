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
 */

// ── Pause helper — MUST be defined before any require() so it is available
// in the uncaughtException handler below, even if the crash happens during
// module loading.
const readline = require('readline');

function pauseAndExit(code) {
  try {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n  Press Enter to close this window... ', () => { rl.close(); process.exit(code); });
  } catch {
    process.exit(code);
  }
}

// ── Catch synchronous crashes (e.g. thrown from require('./config') if env
// vars are missing) BEFORE they silently close the window.
process.on('uncaughtException', (err) => {
  process.stderr.write('\n');
  process.stderr.write('  ╔══════════════════════════════════════════════════════╗\n');
  process.stderr.write('  ║                  SETUP FAILED                       ║\n');
  process.stderr.write('  ╚══════════════════════════════════════════════════════╝\n');
  process.stderr.write('\n  \u274C ' + err.message + '\n\n');
  process.stderr.write('  Common causes:\n');
  process.stderr.write('    \u2022 Not running as Administrator \u2014 right-click \u2192 Run as administrator\n');
  process.stderr.write('    \u2022 No internet connection on this PC\n');
  process.stderr.write('    \u2022 Pairing code expired \u2014 generate a new one in the dashboard\n');
  process.stderr.write('\n  Log file: C:\\ProgramData\\GuardianDesk\\agent.log\n\n');
  pauseAndExit(1);
});

// ── Now safe to require modules — any throw is caught above ────────────────
const path = require('path');
const fs   = require('fs');

// ---------------------------------------------------------------------------
// resolveAgentPath — locate agent.js / guardiandesk-agent.exe correctly
// regardless of whether we are running inside a pkg snapshot or from source.
//
// Inside a pkg snapshot __dirname is a VIRTUAL path like:
//   /snapshot/guardiandesk-agent
// Windows Services cannot spawn a process from a virtual snapshot path, so
// we must point at the real guardiandesk-agent.exe that sits next to the
// setup exe on disk.
//
// Outside pkg (dev / node setup.js) we fall back to agent.js in __dirname.
// ---------------------------------------------------------------------------

function resolveAgentPath() {
  if (typeof process.pkg !== 'undefined') {
    // Running inside a pkg snapshot — the real exe lives beside this exe.
    return path.join(path.dirname(process.execPath), 'guardiandesk-agent.exe');
  }
  // Running from source with plain `node setup.js`
  return path.join(__dirname, 'agent.js');
}

const tokenStore         = require('./lib/tokenStore');
const { pairDevice }     = require('./lib/pairing');
const { configWarnings } = require('./config');
const serviceManager     = require('./lib/serviceManager');

// ---------------------------------------------------------------------------
// Console helpers (only used here — never imported by agent.js)
// ---------------------------------------------------------------------------

function println(msg)       { process.stdout.write(msg + '\n'); }
function printOk(msg)       { println(`  \u2705 ${msg}`); }
function printErr(msg)      { process.stderr.write(`  \u274C ${msg}\n`); }
function printWarn(msg)     { println(`  \u26A0\uFE0F  ${msg}`); }
function printStep(n, msg)  { println(`\n[${n}] ${msg}`); }

function printBanner() {
  println('');
  println('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  println('\u2551         GuardianDesk Agent \u2014 Setup Wizard            \u2551');
  println('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D');
  println('');
}

/**
 * Read one line of input from stdin.
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

// ---------------------------------------------------------------------------
// STEP C — Install Windows Service
// ---------------------------------------------------------------------------

async function installAndStartService() {
  const agentExePath = resolveAgentPath();

  if (!fs.existsSync(agentExePath)) {
    throw new Error(
      `guardiandesk-agent.exe not found at ${agentExePath}. ` +
      'Make sure it is in the same folder as this setup exe.'
    );
  }

  const alreadyInstalled = await serviceManager.isServiceInstalled();

  await serviceManager.installService({
    agentExePath,
    env: {
      SUPABASE_URL:         process.env.SUPABASE_URL         || '',
      SUPABASE_ANON_KEY:    process.env.SUPABASE_ANON_KEY    || '',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
    },
  });
  printOk(alreadyInstalled
    ? 'Service is already installed \u2014 re-verified configuration.'
    : 'Windows Service registered (via nssm).');

  println('  Ensuring it is started...');
  await serviceManager.startService();
  printOk('GuardianDeskAgent service started.');

  println('');
  println('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  println('\u2551  \u2705  GuardianDesk is now running in the background.  \u2551');
  println('\u2551      You can safely close this window.               \u2551');
  println('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D');
  println('');
  println('  The agent will start automatically every time this PC boots.');
  println('  Check the parent dashboard to confirm this device is online.');
  println('');
}

// ---------------------------------------------------------------------------
// Main setup flow
// ---------------------------------------------------------------------------

async function main() {
  printBanner();

  for (const warning of configWarnings) {
    printWarn(warning);
  }

  // ── STEP A: Check for existing credentials ────────────────────────────────
  printStep('1', 'Checking for existing device credentials...');
  const existing = tokenStore.loadToken();

  if (existing) {
    printOk(`This device is already paired (device_id: ${existing.deviceId})`);
    println('  Skipping pairing \u2014 proceeding to service installation.');
    printStep('2', 'Installing / verifying Windows Service...');
    await installAndStartService();
    return;
  }

  println('  No credentials found \u2014 starting first-time pairing.');

  // ── STEP B: Pairing ───────────────────────────────────────────────────────
  printStep('2', 'Device Pairing');
  println('');
  println('  On the PARENT device, open the GuardianDesk dashboard,');
  println('  go to  Devices \u2192 Pair New Device  and copy the 6-digit code.');
  println('');

  let code;
  for (let attempt = 1; attempt <= 3; attempt++) {
    code = await readLine(`  Enter 6-digit pairing code (attempt ${attempt}/3): `);

    if (/^\d{6}$/.test(code)) break;

    printErr('Code must be exactly 6 digits (e.g. 482093). Try again.');
    if (attempt === 3) {
      printErr('Too many invalid attempts. Please re-run setup with a fresh code.');
      pauseAndExit(1);
      return;
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
    println('    \u2022 The code has expired (codes are valid for 15 minutes).');
    println('    \u2022 The code was already used \u2014 generate a new one in the dashboard.');
    println('    \u2022 No internet connection on this PC.');
    println('');
    println('  Re-run this setup after getting a fresh code from the dashboard.');
    pauseAndExit(1);
    return;
  }

  println('  Saving encrypted credentials to disk...');
  try {
    tokenStore.saveToken(deviceId, deviceToken);
  } catch (err) {
    printErr(`Failed to save credentials: ${err.message}`);
    printErr('Make sure this program is running as Administrator.');
    pauseAndExit(1);
    return;
  }

  printStep('3', 'Verifying saved credentials...');
  const verified = tokenStore.loadToken();

  if (!verified || verified.deviceId !== deviceId) {
    printErr('Credential verification failed \u2014 the file was written but cannot be read back.');
    printErr('This could be a permissions issue or a disk error.');
    printErr('Try re-running setup as Administrator.');
    pauseAndExit(1);
    return;
  }

  printOk('Credentials saved and verified successfully.');

  printStep('4', 'Installing Windows Service...');
  println('  (This requires Administrator privileges)');

  try {
    await installAndStartService();
  } catch (err) {
    printErr(`Service installation failed: ${err.message}`);
    printErr('Make sure you are running this as Administrator.');
    printErr('The device IS paired \u2014 you can re-run setup to retry service installation.');
    pauseAndExit(1);
    return;
  }
}

// ── Async error boundary ──────────────────────────────────────────────────────
// Catches rejections from main() — synchronous throws are caught by the
// uncaughtException handler registered at the top of this file.
main().catch((err) => {
  process.stderr.write('\n');
  process.stderr.write('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n');
  process.stderr.write('  \u2551                  SETUP FAILED                       \u2551\n');
  process.stderr.write('  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n');
  process.stderr.write('\n  \u274C ' + err.message + '\n\n');
  process.stderr.write('  Common causes:\n');
  process.stderr.write('    \u2022 Not running as Administrator \u2014 right-click \u2192 Run as administrator\n');
  process.stderr.write('    \u2022 No internet connection on this PC\n');
  process.stderr.write('    \u2022 Pairing code expired \u2014 generate a new one in the dashboard\n');
  process.stderr.write('\n  Log file: C:\\ProgramData\\GuardianDesk\\agent.log\n\n');
  pauseAndExit(1);
});
