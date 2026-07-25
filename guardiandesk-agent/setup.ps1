# GuardianDesk Agent — Self-Extracting Setup Script
# setup.ps1
#
# This script is bundled inside the self-extracting installer produced by
# the GitHub Actions release workflow.  When a parent runs
#   GuardianDesk-Setup-v1.x.x.exe  (as Administrator)
# it self-extracts to a temp folder and executes THIS script automatically.
#
# What it does:
#   1. Checks for Administrator rights (exits if not elevated)
#   2. Checks for Node.js — installs it silently via winget if missing
#   3. Copies guardiandesk-agent.exe to C:\Program Files\GuardianDesk\
#   4. Writes an uninstall.bat for clean removal
#   5. Runs guardiandesk-agent.exe as the install step (which triggers the
#      pairing prompt + node-windows service registration)
#
# The script is intentionally verbose — it prints every step so a parent
# can see what is happening in the console window.

#Requires -RunAsAdministrator

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
$InstallDir  = "C:\Program Files\GuardianDesk"
$AgentExe    = Join-Path $InstallDir "guardiandesk-agent.exe"
$UninstallBat = Join-Path $InstallDir "uninstall.bat"

# The extracted files land in the same folder as this script
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceExe   = Join-Path $ScriptDir "guardiandesk-agent.exe"

# ─────────────────────────────────────────────────────────────────────────────
# Helper: coloured status lines
# ─────────────────────────────────────────────────────────────────────────────
function Write-Step  { param([string]$msg) Write-Host "`n[*] $msg" -ForegroundColor Cyan   }
function Write-Ok    { param([string]$msg) Write-Host "    [OK] $msg" -ForegroundColor Green  }
function Write-Warn  { param([string]$msg) Write-Host "    [!]  $msg" -ForegroundColor Yellow }
function Write-Fatal { param([string]$msg) Write-Host "`n[FATAL] $msg" -ForegroundColor Red; exit 1 }

# ─────────────────────────────────────────────────────────────────────────────
# 0. Banner
# ─────────────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host "================================================================" -ForegroundColor Blue
Write-Host "         GuardianDesk Agent — Windows Setup" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Blue
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. Confirm Administrator
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Checking privileges..."
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Fatal "This installer must be run as Administrator. Right-click the .exe and choose 'Run as administrator'."
}
Write-Ok "Running as Administrator."

# ─────────────────────────────────────────────────────────────────────────────
# 2. Check for Node.js (agent.exe is a self-contained pkg bundle — Node NOT needed)
#    The packaged .exe embeds Node, so this step is informational only.
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Checking Node.js (not required for the packaged agent)..."
try {
    $nodeVer = & node --version 2>$null
    Write-Ok "Node.js found: $nodeVer (not required at runtime but useful for development)."
} catch {
    Write-Warn "Node.js not found — that's fine. The packaged agent is self-contained."
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Create install directory and copy agent
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Installing agent to $InstallDir ..."

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Write-Ok "Created $InstallDir"
} else {
    Write-Ok "$InstallDir already exists."
}

if (-not (Test-Path $SourceExe)) {
    Write-Fatal "guardiandesk-agent.exe not found in the setup folder ($ScriptDir). The installer may be corrupted."
}

Copy-Item -Path $SourceExe -Destination $AgentExe -Force
Write-Ok "Copied agent to $AgentExe"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Write uninstall.bat
#    A parent can remove the agent by running this as Administrator.
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Writing uninstall helper..."

$uninstallContent = @"
@echo off
echo [GuardianDesk] Uninstalling...
REM Stop and remove the Windows Service
sc stop  GuardianDeskAgent 2>nul
sc delete GuardianDeskAgent 2>nul
REM Remove all GuardianDesk firewall rules
netsh advfirewall firewall delete rule name="GuardianDesk_Block_*" 2>nul
REM Delete stored credentials
del /F /Q "%PROGRAMDATA%\GuardianDesk\device.dat" 2>nul
rmdir /S /Q "%PROGRAMDATA%\GuardianDesk" 2>nul
REM Delete install directory
rd /S /Q "C:\Program Files\GuardianDesk" 2>nul
echo [GuardianDesk] Uninstalled successfully.
pause
"@

Set-Content -Path $UninstallBat -Value $uninstallContent -Encoding ASCII
Write-Ok "Uninstall script written to $UninstallBat"

# ─────────────────────────────────────────────────────────────────────────────
# 5. Run the agent installer (triggers pairing prompt + service registration)
#
#    guardiandesk-agent.exe is the pkg-bundled version of install.js.
#    It will:
#      a) Check for existing credentials in %PROGRAMDATA%\GuardianDesk\device.dat
#      b) If none found: prompt for the 6-digit pairing code interactively
#      c) Register the Windows Service and configure auto-restart on failure
#      d) Start the service immediately
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Running agent setup (pairing + service registration)..."
Write-Host ""
Write-Host "  You will be prompted for a 6-digit pairing code." -ForegroundColor Yellow
Write-Host "  Open the GuardianDesk dashboard on the PARENT device," -ForegroundColor Yellow
Write-Host "  go to Devices → Pair New Device, and copy the code shown there." -ForegroundColor Yellow
Write-Host ""

# Run the embedded install entrypoint.
# The pkg-packaged exe exposes install.js behaviour when called with --install flag.
# (See agent.js top-level: if process.argv includes '--install', run install flow)
try {
    & $AgentExe --install
    if ($LASTEXITCODE -ne 0) {
        Write-Fatal "Agent setup exited with code $LASTEXITCODE. Check the output above for errors."
    }
} catch {
    Write-Fatal "Failed to launch agent installer: $_"
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. Verify the service is running
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Verifying service status..."
Start-Sleep -Seconds 3   # give the SCM a moment to start the service

$svcStatus = (Get-Service -Name 'GuardianDeskAgent' -ErrorAction SilentlyContinue).Status
if ($svcStatus -eq 'Running') {
    Write-Ok "GuardianDeskAgent service is RUNNING."
} else {
    Write-Warn "Service status: $svcStatus. It may still be starting. Check services.msc."
}

# ─────────────────────────────────────────────────────────────────────────────
# 7. Done
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================" -ForegroundColor Blue
Write-Host "  GuardianDesk Agent installed successfully!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Blue
Write-Host ""
Write-Host "  The agent is now running as a background Windows Service."
Write-Host "  It will start automatically every time this PC boots."
Write-Host ""
Write-Host "  To remove it, run as Administrator:"
Write-Host "    $UninstallBat" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Check the parent dashboard to confirm this device appears online."
Write-Host ""

Read-Host "Press Enter to close this window"
