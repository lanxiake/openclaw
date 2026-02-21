<#
.SYNOPSIS
    OpenClaw Service Manager

.DESCRIPTION
    Start/stop OpenClaw services with optional build step.
    Services: gateway, api-server, admin-console, windows

.PARAMETER Action
    Action: start, stop, restart, status, build

.PARAMETER Service
    Service name: all, gateway, api-server, admin-console, windows
    Default: all

.PARAMETER NoBuild
    Skip the build step when starting/restarting services

.EXAMPLE
    .\services.ps1 start              # Build + start backend services
    .\services.ps1 start all          # Build + start backend services (gateway, api-server, admin-console)
    .\services.ps1 start windows      # Start Windows client (no build needed, uses electron-vite dev)
    .\services.ps1 start -NoBuild     # Start without building
    .\services.ps1 stop               # Stop all services (including windows)
    .\services.ps1 stop windows       # Stop Windows client only
    .\services.ps1 restart            # Build + restart all services
    .\services.ps1 restart -NoBuild   # Restart without building
    .\services.ps1 status             # Show service status
    .\services.ps1 build              # Build only (no start)
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "build")]
    [string]$Action,

    [Parameter(Position=1)]
    [ValidateSet("all", "gateway", "api-server", "admin-console", "windows")]
    [string]$Service = "all",

    [switch]$NoBuild
)

# Project root directory
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# ============================================================================
# Helper functions
# ============================================================================

# Load .env file and return environment variables as hashtable
function Get-EnvFromFile {
    param([string]$EnvFilePath)

    $envVars = @{}
    if (Test-Path $EnvFilePath) {
        Get-Content $EnvFilePath | ForEach-Object {
            $line = $_.Trim()
            # Skip comments and empty lines
            if ($line -and -not $line.StartsWith("#")) {
                $parts = $line -split "=", 2
                if ($parts.Count -eq 2) {
                    $key = $parts[0].Trim()
                    $value = $parts[1].Trim()
                    # Remove surrounding quotes if present
                    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                        $value = $value.Substring(1, $value.Length - 2)
                    }
                    $envVars[$key] = $value
                }
            }
        }
    }
    return $envVars
}

# Log output function
function Write-ServiceLog {
    param(
        [string]$ServiceName,
        [string]$Message,
        [string]$Color = "White"
    )
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] " -NoNewline -ForegroundColor DarkGray
    Write-Host "[$ServiceName] " -NoNewline -ForegroundColor $Color
    Write-Host $Message
}

# Check if port is in use (only LISTEN state, ignore TIME_WAIT)
function Test-PortListening {
    param([int]$Port)
    if ($null -eq $Port -or $Port -eq 0) { return $false }
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Get process listening on port (only LISTEN state)
function Get-PortListeningProcess {
    param([int]$Port)
    if ($null -eq $Port -or $Port -eq 0) { return $null }
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        # Handle both single and multiple connections
        $conn = if ($connections -is [array]) { $connections[0] } else { $connections }
        $procId = $conn.OwningProcess
        if ($procId -and $procId -gt 0) {
            return Get-Process -Id $procId -ErrorAction SilentlyContinue
        }
    }
    return $null
}

# ============================================================================
# Service configuration
# ============================================================================

$Services = @{
    "gateway" = @{
        Name = "Gateway"
        Port = 18789
        WorkDir = $ProjectRoot
        StartCmd = "node scripts/run-node.mjs --dev gateway --allow-unconfigured"
        Color = "Cyan"
        EnvFile = "$ProjectRoot\.env"
        NeedsBuild = $true
        ExtraEnv = @{
            "OPENCLAW_SKIP_CHANNELS" = "1"
            "CLAWDBOT_SKIP_CHANNELS" = "1"
            "OPENCLAW_GATEWAY_PORT" = "18789"
        }
    }
    "api-server" = @{
        Name = "API Server"
        Port = 3000
        WorkDir = "$ProjectRoot\apps\api-server"
        StartCmd = "pnpm dev"
        Color = "Green"
        EnvFile = "$ProjectRoot\apps\api-server\.env"
        NeedsBuild = $false
        ExtraEnv = @{}
    }
    "admin-console" = @{
        Name = "Admin Console"
        Port = 5176
        WorkDir = "$ProjectRoot\apps\admin-console"
        StartCmd = "pnpm dev"
        Color = "Yellow"
        EnvFile = $null
        NeedsBuild = $false
        ExtraEnv = @{}
    }
    "windows" = @{
        Name = "Windows Client"
        Port = $null
        WorkDir = "$ProjectRoot\apps\windows"
        StartCmd = "pnpm dev"
        Color = "Blue"
        EnvFile = $null
        NeedsBuild = $false
        ExtraEnv = @{}
    }
}

# ============================================================================
# Build function
# ============================================================================

function Invoke-Build {
    Write-Host ""
    Write-ServiceLog "Build" "Building project (pnpm build)..." "Magenta"

    $buildStartTime = Get-Date

    # Use cmd.exe to run pnpm (pnpm is a .cmd wrapper on Windows)
    $result = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm build" -WorkingDirectory $ProjectRoot -NoNewWindow -PassThru -Wait

    $buildDuration = (Get-Date) - $buildStartTime
    $durationStr = "{0:N1}s" -f $buildDuration.TotalSeconds

    if ($result.ExitCode -eq 0) {
        Write-ServiceLog "Build" "Build succeeded ($durationStr)" "Green"
        return $true
    } else {
        Write-ServiceLog "Build" "Build FAILED (exit code: $($result.ExitCode), $durationStr)" "Red"
        return $false
    }
}

# ============================================================================
# Start/Stop functions
# ============================================================================

# Start a single service
function Start-SingleService {
    param([string]$ServiceKey)

    $svc = $Services[$ServiceKey]
    $name = $svc.Name
    $color = $svc.Color

    Write-ServiceLog $name "Starting..." $color

    # Check if port is already listening
    if ($svc.Port -and (Test-PortListening $svc.Port)) {
        $proc = Get-PortListeningProcess $svc.Port
        $pidStr = if ($proc) { $proc.Id } else { "unknown" }
        Write-ServiceLog $name "Port $($svc.Port) already in use (PID: $pidStr)" "Red"
        return $false
    }

    # Check if work directory exists
    if (-not (Test-Path $svc.WorkDir)) {
        Write-ServiceLog $name "Work directory not found: $($svc.WorkDir)" "Red"
        return $false
    }

    # Build environment variable string for the command
    $envSetCmd = ""
    if ($svc.EnvFile -and (Test-Path $svc.EnvFile)) {
        $envVars = Get-EnvFromFile $svc.EnvFile
        foreach ($key in $envVars.Keys) {
            $value = $envVars[$key]
            $escapedValue = $value -replace "'", "''"
            $envSetCmd += "`$env:$key = '$escapedValue'; "
        }
        Write-ServiceLog $name "Loading env from: $($svc.EnvFile)" $color
    }

    # Add extra environment variables
    if ($svc.ExtraEnv) {
        foreach ($key in $svc.ExtraEnv.Keys) {
            $value = $svc.ExtraEnv[$key]
            $escapedValue = $value -replace "'", "''"
            $envSetCmd += "`$env:$key = '$escapedValue'; "
        }
    }

    # Start service in new PowerShell window
    $startInfo = @{
        FilePath = "powershell.exe"
        ArgumentList = @(
            "-NoExit",
            "-Command",
            "$envSetCmd Set-Location '$($svc.WorkDir)'; `$Host.UI.RawUI.WindowTitle = 'OpenClaw - $name'; $($svc.StartCmd)"
        )
        WorkingDirectory = $svc.WorkDir
    }

    Start-Process @startInfo

    # Wait for service to start
    if ($svc.Port) {
        Write-ServiceLog $name "Waiting for port $($svc.Port)..." $color
        $maxWait = 30
        $waited = 0
        while (-not (Test-PortListening $svc.Port) -and $waited -lt $maxWait) {
            Start-Sleep -Seconds 1
            $waited++
        }

        if (Test-PortListening $svc.Port) {
            $proc = Get-PortListeningProcess $svc.Port
            $pidStr = if ($proc) { " (PID: $($proc.Id))" } else { "" }
            Write-ServiceLog $name "Started on port $($svc.Port)$pidStr" "Green"
            return $true
        } else {
            Write-ServiceLog $name "Timeout waiting for port $($svc.Port) - check service window" "Yellow"
            return $false
        }
    } else {
        Start-Sleep -Seconds 1
        Write-ServiceLog $name "Started (no port check)" "Green"
        return $true
    }
}

# Stop a single service
function Stop-SingleService {
    param([string]$ServiceKey)

    $svc = $Services[$ServiceKey]
    $name = $svc.Name
    $color = $svc.Color

    Write-ServiceLog $name "Stopping..." $color

    $stopped = $false
    $killedPids = @{}

    # Find and stop process by port (LISTEN state only)
    if ($svc.Port -and (Test-PortListening $svc.Port)) {
        $proc = Get-PortListeningProcess $svc.Port
        if ($proc -and $proc.Id -gt 0) {
            Write-ServiceLog $name "Killing listener PID: $($proc.Id)" $color
            # Kill process tree (parent + children)
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killedPids[$proc.Id] = $true
            $stopped = $true
        }
    }

    # Find and close by window title
    $windows = Get-Process | Where-Object {
        $_.MainWindowTitle -like "*OpenClaw - $name*" -and
        -not $killedPids.ContainsKey($_.Id)
    }
    foreach ($win in $windows) {
        Write-ServiceLog $name "Closing window PID: $($win.Id)" $color
        # Kill the process tree
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$($win.Id)" -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $win.Id -Force -ErrorAction SilentlyContinue
        $killedPids[$win.Id] = $true
        $stopped = $true
    }

    # Wait briefly for port to be released
    if ($svc.Port -and $stopped) {
        $waitCount = 0
        while ((Test-PortListening $svc.Port) -and $waitCount -lt 5) {
            Start-Sleep -Milliseconds 500
            $waitCount++
        }
    }

    if ($stopped) {
        Write-ServiceLog $name "Stopped" "Green"
    } else {
        Write-ServiceLog $name "Not running" "Yellow"
    }

    return $stopped
}

# ============================================================================
# Status functions
# ============================================================================

# Get service status
function Get-SingleServiceStatus {
    param([string]$ServiceKey)

    $svc = $Services[$ServiceKey]
    $name = $svc.Name

    $status = @{
        Name = $name
        Port = $svc.Port
        Running = $false
        PID = $null
    }

    if ($svc.Port) {
        if (Test-PortListening $svc.Port) {
            $proc = Get-PortListeningProcess $svc.Port
            $status.Running = $true
            if ($proc) { $status.PID = $proc.Id }
        }
    } else {
        # For services without port, check window title
        $windows = Get-Process | Where-Object { $_.MainWindowTitle -like "*OpenClaw - $name*" }
        if ($windows) {
            $status.Running = $true
            $firstWin = if ($windows -is [array]) { $windows[0] } else { $windows }
            $status.PID = $firstWin.Id
        }
    }

    return $status
}

# Show status table
function Show-Status {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "                  OpenClaw Service Status                       " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  Service            | Port   | Status   | PID                  " -ForegroundColor Cyan
    Write-Host "----------------------------------------------------------------" -ForegroundColor Cyan

    foreach ($key in @("gateway", "api-server", "admin-console", "windows")) {
        $status = Get-SingleServiceStatus $key
        $svc = $Services[$key]

        $nameStr = $status.Name.PadRight(18)
        $portStr = if ($status.Port) { $status.Port.ToString().PadRight(6) } else { "N/A".PadRight(6) }
        $statusStr = if ($status.Running) { "Running".PadRight(8) } else { "Stopped".PadRight(8) }
        $pidStr = if ($status.PID) { $status.PID.ToString().PadRight(20) } else { "-".PadRight(20) }

        $statusColor = if ($status.Running) { "Green" } else { "Red" }

        Write-Host "  " -NoNewline
        Write-Host $nameStr -NoNewline -ForegroundColor $svc.Color
        Write-Host "| " -NoNewline -ForegroundColor Cyan
        Write-Host $portStr -NoNewline -ForegroundColor White
        Write-Host "| " -NoNewline -ForegroundColor Cyan
        Write-Host $statusStr -NoNewline -ForegroundColor $statusColor
        Write-Host "| " -NoNewline -ForegroundColor Cyan
        Write-Host $pidStr -ForegroundColor White
    }

    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================================================
# Main logic
# ============================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "              OpenClaw Service Manager                          " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Determine target services
# "all" starts backend services only (gateway, api-server, admin-console)
# Use "windows" explicitly to start the Windows client
$targetServices = if ($Service -eq "all") {
    @("gateway", "api-server", "admin-console")
} else {
    @($Service)
}

# Check if build is needed for the target services
function Test-BuildNeeded {
    param([string[]]$ServiceKeys)
    foreach ($key in $ServiceKeys) {
        if ($Services[$key].NeedsBuild) { return $true }
    }
    return $false
}

switch ($Action) {
    "build" {
        $buildOk = Invoke-Build
        if (-not $buildOk) {
            Write-Host "Build failed. Aborting." -ForegroundColor Red
            exit 1
        }
    }

    "start" {
        # Build before starting if needed (unless -NoBuild)
        if (-not $NoBuild -and (Test-BuildNeeded $targetServices)) {
            $buildOk = Invoke-Build
            if (-not $buildOk) {
                Write-Host "Build failed. Aborting start." -ForegroundColor Red
                exit 1
            }
            Write-Host ""
        }

        Write-Host "Starting services: $($targetServices -join ', ')" -ForegroundColor Green
        Write-Host ""

        foreach ($svc in $targetServices) {
            Start-SingleService $svc
            Start-Sleep -Milliseconds 500
        }

        Write-Host ""
        Show-Status
    }

    "stop" {
        # When stopping "all", also stop windows client
        $stopTargets = if ($Service -eq "all") {
            @("windows", "admin-console", "api-server", "gateway")
        } else {
            @($Service)
        }

        Write-Host "Stopping services: $($stopTargets -join ', ')" -ForegroundColor Yellow
        Write-Host ""

        foreach ($svc in $stopTargets) {
            Stop-SingleService $svc
        }

        Write-Host ""
        Show-Status
    }

    "restart" {
        # Stop first (including windows if "all")
        $stopTargets = if ($Service -eq "all") {
            @("windows", "admin-console", "api-server", "gateway")
        } else {
            @($Service)
        }

        Write-Host "Restarting services: $($targetServices -join ', ')" -ForegroundColor Magenta
        Write-Host ""

        foreach ($svc in $stopTargets) {
            Stop-SingleService $svc
        }

        Start-Sleep -Seconds 2

        # Build before restarting if needed (unless -NoBuild)
        if (-not $NoBuild -and (Test-BuildNeeded $targetServices)) {
            $buildOk = Invoke-Build
            if (-not $buildOk) {
                Write-Host "Build failed. Aborting restart." -ForegroundColor Red
                exit 1
            }
            Write-Host ""
        }

        # Then start
        foreach ($svc in $targetServices) {
            Start-SingleService $svc
            Start-Sleep -Milliseconds 500
        }

        Write-Host ""
        Show-Status
    }

    "status" {
        Show-Status
    }
}

Write-Host "Done" -ForegroundColor Green
Write-Host ""
