'use strict';

/**
 * lib/tokenStore.js
 *
 * Persists the device_id and device_token that the agent receives after pairing.
 *
 * Storage path:  %PROGRAMDATA%\GuardianDesk\device.dat
 *   On a standard Windows install this is C:\ProgramData\GuardianDesk\device.dat
 *
 * Security model
 * ──────────────
 * The file is encrypted with AES-256-CBC.  The encryption key is derived from
 * three machine-specific values that are constant for the life of the hardware:
 *
 *   hostname  + os.cpus()[0].model + os.platform()
 *
 * These are hashed together with SHA-256 to produce a 32-byte key.
 * A fresh random IV (16 bytes) is prepended to every write.
 *
 * If the file is copied to another machine the key derivation will produce a
 * different key, decryption will fail, and loadToken() returns null — forcing
 * a fresh pairing on that machine.
 *
 * Note: a child with local admin access can read the raw entropy from the same
 * machine, so this is "security against casual copying", not hardware-level TPM
 * security.  For stronger guarantees, integrate with the Windows DPAPI
 * (crypto.DPAPIProtectData) available via native node addons.
 */

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// %PROGRAMDATA% is guaranteed to exist on every Windows installation.
// Fallback to cwd so the module doesn't crash on dev machines that lack it.
const DATA_DIR  = path.join(process.env.PROGRAMDATA || '.', 'GuardianDesk');
const TOKEN_FILE = path.join(DATA_DIR, 'device.dat');

const ALGORITHM = 'aes-256-cbc';
const IV_BYTES  = 16;   // AES block size
const KEY_BYTES = 32;   // AES-256 requires a 32-byte key

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derives a 32-byte AES key from machine-specific identifiers.
 * Using SHA-256 ensures a fixed-length output regardless of input length.
 *
 * @returns {Buffer} 32-byte key
 */
function deriveMachineKey() {
  // os.cpus() may return an empty array in some containerised environments,
  // so we fall back to a stable string to avoid a crash.
  const cpuModel = (os.cpus()[0] || { model: 'unknown-cpu' }).model;
  const entropy  = `${os.hostname()}::${cpuModel}::${os.platform()}`;

  return crypto.createHash('sha256').update(entropy).digest(); // Buffer(32)
}

/**
 * Ensures the storage directory exists (creates it if needed).
 * Uses recursive: true so it's idempotent.
 */
function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypts and writes { deviceId, deviceToken } to disk.
 *
 * File format (binary):
 *   [16 bytes IV] [N bytes AES-256-CBC ciphertext of UTF-8 JSON]
 *
 * @param {string} deviceId
 * @param {string} deviceToken
 */
function saveToken(deviceId, deviceToken) {
  ensureDataDir();

  const key       = deriveMachineKey();
  const iv        = crypto.randomBytes(IV_BYTES);
  const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify({ deviceId, deviceToken });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Write IV followed by ciphertext as a single binary file.
  const payload = Buffer.concat([iv, encrypted]);
  fs.writeFileSync(TOKEN_FILE, payload);

  console.log(`[tokenStore] Credentials saved to ${TOKEN_FILE}`);
}

/**
 * Reads and decrypts the stored credentials.
 *
 * @returns {{ deviceId: string, deviceToken: string } | null}
 *   Returns null if the file doesn't exist, is too short, or decryption fails
 *   (e.g. wrong machine, corrupted file).
 */
function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }

  try {
    const payload = fs.readFileSync(TOKEN_FILE);

    if (payload.length <= IV_BYTES) {
      console.warn('[tokenStore] device.dat is too short — treating as invalid.');
      return null;
    }

    const iv         = payload.subarray(0, IV_BYTES);
    const ciphertext = payload.subarray(IV_BYTES);
    const key        = deriveMachineKey();
    const decipher   = crypto.createDecipheriv(ALGORITHM, key, iv);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext); // { deviceId, deviceToken }
  } catch (err) {
    // Wrong machine key, corrupted file, or bad JSON — all are non-fatal here.
    console.warn(`[tokenStore] Failed to decrypt device.dat: ${err.message}`);
    return null;
  }
}

/**
 * Deletes the stored credentials file.
 * Called by uninstall.js during service removal.
 */
function deleteToken() {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
    console.log(`[tokenStore] Deleted ${TOKEN_FILE}`);
  }
}

module.exports = { saveToken, loadToken, deleteToken, TOKEN_FILE };
