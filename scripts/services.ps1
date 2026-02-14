<#
.SYNOPSIS
    OpenClaw Service Manager

.DESCRIPTION
    Start/stop OpenClaw services
    Services: gateway, api-server, admin-console, web-admin, windows

.PARAMETER Action
    Action: start, stop, restart, status

.PARAMETER Service
    Service name: all, gateway, api-server, admin-console, web-admin, windows
    Default: all

.EXAMPLE
    .\services.ps1 start              # Start all services
    .\services.ps1 stop               # Stop all services
    .\services.ps1 start gateway      # Start Gateway only
    .\services.ps1 stop api-server    # Stop API Server only
    .\services.ps1 status             # Show service status
    .\services.ps1 restart            # Restart all services
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action,

    [Parameter(Position=1)]
    [ValidateSet("all", "gateway", "api-server", "admin-console", "web-admin", "windows")]
    [string]$Service = "all"
)

# Project root directory
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

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

# Service configuration
$Services = @{
    "gateway" = @{
        Name = "Gateway"
        Port = 18789
        WorkDir = $ProjectRoot
        StartCmd = "node scripts/run-node.mjs --dev gateway --allow-unconfigured"
        Color = "Cyan"
        EnvFile = "$ProjectRoot\.env"
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
        ExtraEnv = @{}
    }
    "admin-console" = @{
        Name = "Admin Console"
        Port = 5176
        WorkDir = "$ProjectRoot\apps\admin-console"
        StartCmd = "pnpm dev"
        Color = "Yellow"
        EnvFile = $null
        ExtraEnv = @{}
    }
    "web-admin" = @{
        Name = "Web Admin"
        Port = 5173
        WorkDir = "$ProjectRoot\apps\web-admin"
        StartCmd = "pnpm dev"
        Color = "Magenta"
        EnvFile = $null
        ExtraEnv = @{}
    }
    "windows" = @{
        Name = "Windows Client"
        Port = $null
        WorkDir = "$ProjectRoot\apps\windows"
        StartCmd = "pnpm dev"
        Color = "Blue"
        EnvFile = $null
        ExtraEnv = @{}
    }
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

# Check if port is in use
function Test-PortInUse {
    param([int]$Port)
    if ($null -eq $Port) { return $false }
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Get process using port
function Get-PortProcess {
    param([int]$Port)
    if ($null -eq $Port) { return $null }
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connection) {
        return Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
    }
    return $null
}

# Start a single service
function Start-SingleService {
    param([string]$ServiceKey)

    $svc = $Services[$ServiceKey]
    $name = $svc.Name
    $color = $svc.Color

    Write-ServiceLog $name "Starting..." $color

    # Check if port is already in use
    if ($svc.Port -and (Test-PortInUse $svc.Port)) {
        $proc = Get-PortProcess $svc.Port
        Write-ServiceLog $name "Port $($svc.Port) already in use (PID: $($proc.Id))" "Red"
        return $false
    }

    # Check if work directory exists
    if (-not (Test-Path $svc.WorkDir)) {
        Write-ServiceLog $name "Work directory not found: $($svc.WorkDir)" "Red"
        return $false
    }

    # Start service in new PowerShell window
    # Build environment variable string for the command
    $envSetCmd = ""
    if ($svc.EnvFile -and (Test-Path $svc.EnvFile)) {
        $envVars = Get-EnvFromFile $svc.EnvFile
        foreach ($key in $envVars.Keys) {
            $value = $envVars[$key]
            # Escape special characters in value
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
        while (-not (Test-PortInUse $svc.Port) -and $waited -lt $maxWait) {
            Start-Sleep -Seconds 1
            $waited++
        }

        if (Test-PortInUse $svc.Port) {
            Write-ServiceLog $name "Started (port: $($svc.Port))" "Green"
            return $true
        } else {
            Write-ServiceLog $name "Timeout - check logs" "Yellow"
            return $false
        }
    } else {
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

    # Find and stop process by port
    if ($svc.Port -and (Test-PortInUse $svc.Port)) {
        $proc = Get-PortProcess $svc.Port
        if ($proc) {
            Write-ServiceLog $name "Killing process PID: $($proc.Id)" $color
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }

    # Find and close by window title
    $windows = Get-Process | Where-Object { $_.MainWindowTitle -like "*OpenClaw - $name*" }
    foreach ($win in $windows) {
        Write-ServiceLog $name "Closing window PID: $($win.Id)" $color
        Stop-Process -Id $win.Id -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }

    if ($stopped) {
        Write-ServiceLog $name "Stopped" "Green"
    } else {
        Write-ServiceLog $name "Not running" "Yellow"
    }

    return $stopped
}

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
        if (Test-PortInUse $svc.Port) {
            $proc = Get-PortProcess $svc.Port
            $status.Running = $true
            $status.PID = $proc.Id
        }
    } else {
        # For services without port, check window title
        $windows = Get-Process | Where-Object { $_.MainWindowTitle -like "*OpenClaw - $name*" }
        if ($windows) {
            $status.Running = $true
            $status.PID = $windows[0].Id
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

    foreach ($key in @("gateway", "api-server", "admin-console", "web-admin", "windows")) {
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

# Main logic
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "              OpenClaw Service Manager                          " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Determine target services
$targetServices = if ($Service -eq "all") {
    @("gateway", "api-server", "admin-console", "web-admin")
} else {
    @($Service)
}

switch ($Action) {
    "start" {
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
        Write-Host "Stopping services: $($targetServices -join ', ')" -ForegroundColor Yellow
        Write-Host ""

        # Stop in reverse order (frontend first, then backend)
        $reversed = $targetServices | Sort-Object -Descending
        foreach ($svc in $reversed) {
            Stop-SingleService $svc
        }

        Write-Host ""
        Show-Status
    }

    "restart" {
        Write-Host "Restarting services: $($targetServices -join ', ')" -ForegroundColor Magenta
        Write-Host ""

        # Stop first
        $reversed = $targetServices | Sort-Object -Descending
        foreach ($svc in $reversed) {
            Stop-SingleService $svc
        }

        Start-Sleep -Seconds 2

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
