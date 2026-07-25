'use strict';

/**
 * lib/appScanner.js
 *
 * Discovers what is running and what is installed on the Windows machine.
 *
 * Two exported functions:
 *
 *   getRunningApps()    — reads the live process list
 *   getInstalledApps()  — queries the Windows Registry via PowerShell
 *
 * Both return plain arrays so agent.js can merge them before sending to the
 * `sync-apps` Edge Function.
 */

const { exec } = require('child_process');
const util     = require('util');

const execAsync = util.promisify(exec);

// Maximum bytes we'll read from any child process stdout.
// Prevent memory exhaustion if a runaway process floods the pipe.
const MAX_BUFFER = 8 * 1024 * 1024; // 8 MB

// ---------------------------------------------------------------------------
// getRunningApps
// ---------------------------------------------------------------------------

/**
 * Returns the list of currently running processes using the built-in
 * Windows `tasklist` command.
 *
 * Command: tasklist /FO CSV /NH
 *
 *   /FO CSV  — output in Comma-Separated Values format
 *   /NH      — suppress the header row (No Header)
 *
 * Sample output line:
 *   "Roblox.exe","12345","Console","1","120,000 K"
 *   field 0 = image name (exe filename)
 *   field 1 = PID
 *
 * @returns {Promise<Array<{ app_name: string, pid: number }>>}
 */
async function getRunningApps() {
  try {
    // chcp 65001 forces UTF-8 output so non-ASCII process names decode correctly.
    const { stdout } = await execAsync('chcp 65001 >nul && tasklist /FO CSV /NH', {
      maxBuffer: MAX_BUFFER,
      // Suppress the "Active code page: 65001" message from chcp
      windowsHide: true,
    });

    const apps = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // tasklist /FO CSV output wraps every field in double-quotes:
      //   "Roblox.exe","12345","Console","1","120,000 K"
      //
      // IMPORTANT: the memory column ("120,000 K") contains a comma, so a
      // naive replace(/"/g,'').split(',') mis-parses the last fields.
      // We use a proper quoted-CSV regex instead:
      //   match all sequences of  "..."  or  [^,]+
      const csvFields = [];
      const csvRe = /"([^"]*)"|([^,]+)/g;
      let m;
      while ((m = csvRe.exec(trimmed)) !== null) {
        csvFields.push((m[1] !== undefined ? m[1] : m[2]).trim());
      }

      const appName = csvFields[0];
      const pid     = parseInt(csvFields[1], 10);

      if (appName && !isNaN(pid)) {
        apps.push({ app_name: appName, pid });
      }
    }

    return apps;
  } catch (err) {
    console.error(`[appScanner] getRunningApps failed: ${err.message}`);
    return [];  // Non-fatal — return empty list so the sync still proceeds
  }
}

// ---------------------------------------------------------------------------
// getInstalledApps
// ---------------------------------------------------------------------------

/**
 * Returns the list of installed applications by reading three Windows
 * Uninstall registry keys via PowerShell.
 *
 * Registry paths checked:
 *
 *   HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall
 *     → 64-bit programs installed for all users
 *
 *   HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall
 *     → 32-bit programs installed on a 64-bit OS (WOW = Windows-on-Windows)
 *
 *   HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall
 *     → Programs installed for the current user only
 *
 * The PowerShell one-liner:
 *   Get-ItemProperty <path>\* | Select-Object DisplayName | ConvertTo-Json
 *
 *   Get-ItemProperty <path>\*  — reads all child keys as property bags
 *   Select-Object DisplayName  — keeps only the human-readable name field
 *   ConvertTo-Json             — serialises to JSON so we can parse it in Node
 *
 * @returns {Promise<Array<{ display_name: string }>>}
 */
async function getInstalledApps() {
  const registryPaths = [
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ];

  const seen   = new Set();  // deduplicate across the three hives
  const result = [];

  for (const regPath of registryPaths) {
    try {
      // -ErrorAction SilentlyContinue suppresses "path not found" warnings
      // for keys that don't exist on a given machine (e.g. WOW6432Node on
      // some 32-bit-only configurations).
      const psCommand =
        `Get-ItemProperty "${regPath}\\*" -ErrorAction SilentlyContinue ` +
        `| Where-Object { $_.DisplayName } ` +
        `| Select-Object -ExpandProperty DisplayName ` +
        `| ConvertTo-Json -Compress`;

      const { stdout } = await execAsync(
        `powershell.exe -NonInteractive -NoProfile -Command "${psCommand}"`,
        { maxBuffer: MAX_BUFFER, windowsHide: true }
      );

      const trimmed = stdout.trim();
      if (!trimmed) continue;  // empty hive — skip

      // ConvertTo-Json outputs either a JSON array or a bare string if there
      // is only one result.  Normalise to an array in both cases.
      let names;
      try {
        const parsed = JSON.parse(trimmed);
        names = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // PowerShell sometimes returns bare text — treat the whole output as
        // one name if JSON parsing fails.
        names = [trimmed];
      }

      for (const name of names) {
        const displayName = (name ?? '').toString().trim();
        if (displayName && !seen.has(displayName.toLowerCase())) {
          seen.add(displayName.toLowerCase());
          result.push({ display_name: displayName });
        }
      }
    } catch (err) {
      // A missing registry path or PowerShell error is not fatal.
      // Log at debug level and continue with whatever we've collected.
      console.warn(`[appScanner] Skipping registry path ${regPath}: ${err.message}`);
    }
  }

  return result;
}

module.exports = { getRunningApps, getInstalledApps };
