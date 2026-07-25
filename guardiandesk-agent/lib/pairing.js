'use strict';

/**
 * lib/pairing.js
 *
 * Performs the NETWORK HALF of the pairing flow only.
 *
 * WHY THIS FILE DOES NOT PROMPT FOR INPUT
 * ────────────────────────────────────────
 * This module is required by BOTH:
 *   • setup.js  — runs interactively in a console window the parent sees
 *   • agent.js  — runs headless as a Windows Service with no stdin/stdout
 *
 * If we embedded `readline` prompts or `process.exit()` calls here, the
 * agent would crash or hang when it required this file.  So pairing.js is
 * a pure "send code, get back credentials" function.  All console I/O and
 * flow control live in setup.js, which is the only entry point that ever
 * talks to a human.
 *
 * Public API
 * ──────────
 *   pairDevice(code) → Promise<{ deviceId, deviceToken }>
 *     - Throws an Error on network failure or bad response.
 *     - Does NOT catch errors; the caller (setup.js) handles them.
 *     - Does NOT call tokenStore.saveToken(); the caller does that too.
 */

const https = require('https');
const http  = require('http');

const { FUNCTIONS_URL } = require('../config');

// ---------------------------------------------------------------------------
// Internal HTTP helper
// ---------------------------------------------------------------------------

/**
 * POST JSON to a URL and return the parsed response body.
 * Rejects with an Error whose message comes from the server's { error: "..." }
 * field, or from the HTTP status, so callers get a human-readable message.
 *
 * @param {string} url
 * @param {object} body
 * @returns {Promise<object>}
 */
function postJSON(url, body) {
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
              // Prefer the server's error field; fall back to the HTTP status
              reject(new Error(data.error || `HTTP ${res.statusCode}`));
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calls the `pair-device` Edge Function with the given 6-digit code.
 *
 * On success  → resolves with { deviceId: string, deviceToken: string }
 * On failure  → rejects with an Error (caller must handle it)
 *
 * @param {string} code   6-digit pairing code entered by the parent
 * @returns {Promise<{ deviceId: string, deviceToken: string }>}
 */
async function pairDevice(code) {
  if (!FUNCTIONS_URL) {
    throw new Error('FUNCTIONS_URL is not configured — check SUPABASE_URL in your environment.');
  }

  const url = `${FUNCTIONS_URL}/pair-device`;
  const response = await postJSON(url, { pairing_code: code });

  const { device_id: deviceId, device_token: deviceToken } = response;

  if (!deviceId || !deviceToken) {
    throw new Error('Server returned success but device_id or device_token is missing.');
  }

  return { deviceId, deviceToken };
}

module.exports = { pairDevice };
