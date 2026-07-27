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

// When running inside a pkg snapshot __dirname is a virtual path like
// /snapshot/guardiandesk-agent — dotenv's default (process.cwd()) would
// look on the real filesystem where the .env doesn't exist.
// Passing __dirname explicitly makes dotenv read the .env that pkg bundled
// into the snapshot as an asset (see package.json → pkg.assets).
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const SUPABASE_URL        = process.env.SUPABASE_URL      || '';
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY || '';

// SUPABASE_SERVICE_KEY is used ONLY for the Realtime WebSocket so
// postgres_changes events pass through RLS (anon key has no SELECT policy on
// the apps table). It is never sent to the child's browser or written to logs.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || null;

// Edge Function base URL — derived from SUPABASE_URL automatically.
// All Edge Functions are reachable at <project>.supabase.co/functions/v1/<name>
const FUNCTIONS_URL = SUPABASE_URL
  ? SUPABASE_URL + '/functions/v1'
  : null;

// ---------------------------------------------------------------------------
// Deferred warnings — written to the log file by the caller (agent.js / setup.js)
// so they are visible even when there is no console attached.
// ---------------------------------------------------------------------------
/** @type {string[]} */
const configWarnings = [];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Throw instead of process.exit so setup.js can catch it and keep the
  // console window open with a readable error message (exit(1) from a module
  // bypasses the top-level catch in setup.js and closes the window instantly).
  throw new Error(
    'Missing Supabase configuration — the installer was built without credentials.\n' +
    '  This usually means the GitHub Actions secrets were not set before tagging.\n' +
    '  Contact the developer or check: https://github.com/dev-Basscee/Parental-control/releases'
  );
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
