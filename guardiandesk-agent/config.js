'use strict';

/**
 * config.js
 *
 * Loads environment variables from a .env file (if present) and exports
 * the Supabase connection settings needed by every other module.
 *
 * During development: put a .env file in the project root.
 * In production (packaged .exe): the CI workflow writes a .env before pkg
 * bundles the exe, so dotenv picks it up from the snapshot filesystem.
 *
 * IMPORTANT: config.js must NOT use console.log / console.warn for warnings
 * because it is required by agent.js, which runs as a headless Windows Service
 * with no console.  Instead it exposes a configWarnings[] array that agent.js
 * writes to its log file after the logger is initialised.
 */

require('dotenv').config();

const SUPABASE_URL        = process.env.SUPABASE_URL      || '';
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY || '';

// SUPABASE_SERVICE_KEY is used ONLY for the Realtime WebSocket so
// postgres_changes events pass through RLS (anon key has no SELECT policy on
// the apps table). It is never sent to the child's browser or written to logs.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || null;

// Edge Function base URL — derived from SUPABASE_URL automatically.
// All Edge Functions are reachable at <project>.functions.supabase.co/v1/<name>
const FUNCTIONS_URL = SUPABASE_URL
  ? SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co') + '/v1'
  : null;

// ---------------------------------------------------------------------------
// Deferred warnings — written to the log file by the caller (agent.js / setup.js)
// so they are visible even when there is no console attached.
// ---------------------------------------------------------------------------
/** @type {string[]} */
const configWarnings = [];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fatal — process.exit here is acceptable because nothing can work without
  // these two values, and the error will appear in the Windows Event Log
  // (node-windows catches it) even without a console.
  process.stderr.write(
    '[GuardianDesk] FATAL: SUPABASE_URL and SUPABASE_ANON_KEY must be set.\n' +
    'Re-run GuardianDeskSetup.exe to reinstall with correct environment variables.\n'
  );
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  // Non-fatal but important — push to array so agent.js can log it properly.
  configWarnings.push(
    'SUPABASE_SERVICE_KEY is not set. Realtime rule push will use the anon key ' +
    'and may silently drop events due to RLS on the apps table. ' +
    'Add SUPABASE_SERVICE_KEY to your environment for reliable enforcement.'
  );
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  FUNCTIONS_URL,
  configWarnings,
};
