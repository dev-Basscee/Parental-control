# GuardianDesk Agent — Windows Background Service

A Node.js parental-control agent that runs silently on the **child's Windows
PC**, enforces app block rules set by the parent in the GuardianDesk dashboard,
and streams real-time rule changes via Supabase Realtime.

---

## Why there are two entry points

```
setup.js   ← parent double-clicks this ONCE to pair + install the service
agent.js   ← Windows Service runs this headlessly FOREVER after setup
```

These two files are intentionally **separate** for an important reason:

| | `setup.js` | `agent.js` |
|---|---|---|
| Runs | Once, at install time | Continuously, as a background service |
| Has a console | ✅ Yes — can prompt, print, read stdin | ❌ No — no visible window |
| Can ask for input | ✅ Yes | ❌ Never — would hang the service |
| Error reporting | Prints to screen | Writes to `agent.log` file |
| Entry point for `pkg` | ✅ **This one** | ❌ Not directly |

If all logic were in one file, the service would hang waiting for pairing
code input that can never arrive, or crash trying to write to a console that
doesn't exist.

---

## Project structure

```
guardiandesk-agent/
├── setup.js          # Interactive installer: pairing → verify → install service
├── uninstall.js      # Remove service + firewall rules + credentials
├── agent.js          # Headless service: enforce rules + sync apps
├── config.js         # Load env vars (SUPABASE_URL etc.)
├── lib/
│   ├── pairing.js    # HTTP call to pair-device edge function (no I/O)
│   ├── tokenStore.js # AES-256-CBC encrypted device credentials on disk
│   ├── appScanner.js # tasklist + PowerShell registry scanner
│   └── enforcer.js   # taskkill + Windows Firewall rule management
└── package.json
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Node.js ≥ 18** | https://nodejs.org (64-bit recommended) |
| **Administrator rights** | Required for setup.js, taskkill, and netsh |
| **GuardianDesk backend** | Supabase project with migrations + Edge Functions deployed |

---

## Step 1 — Configure environment

Create `.env` in the project root:

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-role-key>
```

`SUPABASE_SERVICE_KEY` is used **only** for the Realtime WebSocket (needed to
bypass RLS on the `apps` table). It is never sent to the child's browser.

Find all three values in **Supabase Dashboard → Settings → API**.

---

## Step 2 — Install dependencies

```
npm install
```

---

## Step 3 — Run setup (as Administrator)

Open an **elevated** PowerShell or CMD:

```
node setup.js
```

### What happens:

**If not yet paired:**
1. Prompts for a 6-digit pairing code.
2. Open the GuardianDesk dashboard → **Devices → Pair New Device** to get the code.
3. Calls the `pair-device` Edge Function.
4. Saves encrypted credentials to `%PROGRAMDATA%\GuardianDesk\device.dat`.
5. **Re-reads and decrypts the file** to confirm the write succeeded.
6. Registers `agent.js` as the **GuardianDeskAgent** Windows Service.
7. Configures auto-restart on crash (5 s → 10 s → 30 s).
8. Starts the service immediately.

**If already paired** (safe to re-run):

Setup detects the existing `device.dat`, skips pairing, and goes straight to
step 6. This makes the installer **idempotent** — a parent can double-click it
again if something seems broken without causing any harm.

---

## Step 4 — Verify

```
sc query GuardianDeskAgent
```

Expected output includes `STATE: 4 RUNNING`.

Or open **Task Manager → Services** and look for `GuardianDeskAgent`.

The parent dashboard should show the device as **online** within ~60 seconds.

---

## Uninstalling

From an **elevated** terminal:

```
node uninstall.js
```

This removes:
- The `GuardianDeskAgent` Windows Service
- All `GuardianDesk_Block_*` Windows Firewall outbound rules
- `%PROGRAMDATA%\GuardianDesk\device.dat` (credentials)
- `%PROGRAMDATA%\GuardianDesk\agent.log` (log files)

---

## Log file

The agent writes to:

```
C:\ProgramData\GuardianDesk\agent.log
```

Rotates to `agent.log.1` at 5 MB. Useful for troubleshooting.

---

## Packaging as a standalone `.exe` for distribution

Parents should not need Node.js installed. Use `pkg`:

```bash
npm install -g pkg@5
pkg setup.js --targets node18-win-x64 --output dist/GuardianDeskSetup.exe
```

**`setup.js` is the pkg entry point** — not `agent.js`. The parent
double-clicks `GuardianDeskSetup.exe` once. After setup, the service runs
`agent.js` directly via node-windows (which stores the script path in the
Windows Service registry).

### How it works end-to-end:

```
Parent double-clicks GuardianDeskSetup.exe (as Admin)
        │
        ▼
  setup.js runs (interactive console)
        │
        ├── [first run]  pairing flow → saves device.dat
        │
        └── [always]     registers + starts GuardianDeskAgent Windows Service
                              │
                              ▼
                         agent.js runs headlessly, forever
                         reads device.dat on every boot
                         syncs apps every 60 s
                         enforces blocks every 10 s
                         receives instant rule push via Realtime
```

---

## ⚠️ Code-signing is required for real-world distribution

The agent's behaviour (hidden service, `taskkill`, `netsh` firewall injection)
**matches malware heuristics**. Windows Defender and SmartScreen will
**quarantine** unsigned executables on first run.

Before distributing to parents:

1. Purchase an EV Code Signing certificate (DigiCert, Sectigo, etc.)
2. Sign with `signtool.exe`:
   ```
   signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 ^
     /f your_cert.p12 dist\GuardianDeskSetup.exe
   ```
3. Optionally submit the file hash to Microsoft's Defender Application Guard
   allowlist to pre-clear it.

> **Without a code signature**, parents will see "Windows protected your PC"
> from SmartScreen. They can click **More info → Run anyway**, but this is a
> bad first-run experience and may alarm non-technical parents.

---

## Security notes

| Threat | Mitigation |
|--------|-----------|
| Credential file copied to another PC | AES-256-CBC key derived from hostname + CPU model + platform. Decryption fails on a different machine. |
| Child stops the service manually | `agent_restarted_after_gap` event sent on next startup → parent dashboard shows tamper warning. |
| Child with local admin removes agent | No technical prevention. GuardianDesk requires the child's account to be a **standard user** (not admin). |
| Service key in env var | Only used for Realtime WebSocket to Supabase. Never sent to the child's browser or exposed in logs. |

---

## GitHub Release (automated)

The `.github/workflows/release.yml` workflow builds a Windows installer on
every `v*.*.*` git tag push:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Action:
1. Runs `pkg setup.js` on a `windows-latest` runner.
2. Packages it with a self-extracting 7-Zip wrapper.
3. Creates a GitHub Release with the `.exe` attached.
4. The release notes include one-click download + installation instructions.

**To embed your Supabase keys into the build**, add these secrets in
**GitHub → Settings → Secrets → Actions**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

The workflow writes them into a `.env` file before calling `pkg`, so they
are bundled into the `.exe` snapshot filesystem and available at runtime
via `dotenv`.

---

## Windows commands reference

| Command | Where used | Purpose |
|---------|-----------|---------|
| `tasklist /FO CSV /NH` | `appScanner.js` | List all running processes as CSV |
| `taskkill /IM <name>.exe /F` | `enforcer.js` | Force-terminate a process by exe name |
| `netsh advfirewall firewall add rule name=... dir=out program=... action=block` | `enforcer.js` | Block outbound network for a specific exe |
| `netsh advfirewall firewall delete rule name=...` | `enforcer.js` | Remove a firewall rule |
| `sc failure GuardianDeskAgent reset=... actions=...` | `setup.js` | Configure service auto-restart on crash |
| `powershell Get-ItemProperty ... \| ConvertTo-Json` | `appScanner.js` | Read installed app names from registry |
| `powershell Get-Process \| Select Name,Path \| ConvertTo-Json` | `agent.js` | Resolve full exe paths for running processes |
