#Requires -Version 5.1
# OpenClaw Gateway Start/Stop Script
# Usage: .\gateway.ps1 [start|stop|restart|status|logs|help]

param(
    [Parameter(Position = 0)]
    [string]$Command = "status"
)

$ErrorActionPreference = "Continue"

# Config
$GatewayPort = 18789
$GatewayLogFile = "$env:TEMP\openclaw-gateway.log"
$ProjectRoot = $PSScriptRoot

# Output functions
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-OK($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# Check if Gateway is listening (only LISTEN state, exclude TIME_WAIT)
function Test-GatewayRunning {
    $listening = Get-NetTCPConnection -LocalPort $GatewayPort -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $listening)
}

# Get Gateway process (the one actually listening)
function Get-GatewayProcess {
    $listening = Get-NetTCPConnection -LocalPort $GatewayPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listening -and $listening.OwningProcess -ne 0) {
        return Get-Process -Id $listening.OwningProcess -ErrorAction SilentlyContinue
    }
    return $null
}

# Stop Gateway
function Stop-Gateway {
    Write-Info "Stopping Gateway..."

    $proc = Get-GatewayProcess
    if ($proc) {
        Write-Info "Killing process $($proc.Name) (PID: $($proc.Id))..."
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue

        # Wait for process to terminate
        $timeout = 10
        $elapsed = 0
        while ((Test-GatewayRunning) -and ($elapsed -lt $timeout)) {
            Start-Sleep -Seconds 1
            $elapsed++
        }

        if (-not (Test-GatewayRunning)) {
            Write-OK "Gateway stopped"
            return $true
        } else {
            Write-Err "Failed to stop Gateway"
            return $false
        }
    } else {
        Write-Warn "Gateway is not running"
        return $true
    }
}

# Start Gateway
function Start-Gateway {
    Write-Info "Starting Gateway..."

    if (Test-GatewayRunning) {
        $proc = Get-GatewayProcess
        Write-Warn "Gateway already running (PID: $($proc.Id))"
        return $true
    }

    # Clear old log
    if (Test-Path $GatewayLogFile) {
        Remove-Item $GatewayLogFile -Force -ErrorAction SilentlyContinue
    }

    # Start Gateway in background
    $pnpmPath = (Get-Command pnpm -ErrorAction SilentlyContinue).Source
    if (-not $pnpmPath) {
        Write-Err "pnpm not found in PATH"
        return $false
    }

    Write-Info "Starting Gateway process..."
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "pnpm openclaw gateway run --bind loopback --port $GatewayPort --force > `"$GatewayLogFile`" 2>&1" `
        -WindowStyle Hidden `
        -WorkingDirectory $ProjectRoot

    # Wait for Gateway to start listening
    Write-Info "Waiting for Gateway to start..."
    $timeout = 30
    $elapsed = 0
    while (-not (Test-GatewayRunning) -and ($elapsed -lt $timeout)) {
        Start-Sleep -Seconds 1
        $elapsed++
        if ($elapsed % 5 -eq 0) {
            Write-Info "Still waiting... ($elapsed seconds)"
        }
    }

    if (Test-GatewayRunning) {
        $proc = Get-GatewayProcess
        Write-OK "Gateway started (PID: $($proc.Id), Port: $GatewayPort)"
        Write-Info "Log file: $GatewayLogFile"
        return $true
    } else {
        Write-Err "Gateway failed to start within $timeout seconds"
        Write-Info "Check log file: $GatewayLogFile"
        return $false
    }
}

# Show status
function Show-Status {
    Write-Host ""
    Write-Host "===== Gateway Status =====" -ForegroundColor Magenta
    Write-Host ""

    if (Test-GatewayRunning) {
        $proc = Get-GatewayProcess
        Write-OK "Gateway is RUNNING"
        Write-Host "  PID:  $($proc.Id)" -ForegroundColor White
        Write-Host "  Port: $GatewayPort" -ForegroundColor White
        Write-Host "  URL:  http://127.0.0.1:$GatewayPort" -ForegroundColor White

        # Show connection count
        $conns = Get-NetTCPConnection -LocalPort $GatewayPort -ErrorAction SilentlyContinue
        $established = ($conns | Where-Object { $_.State -eq 'Established' }).Count
        Write-Host "  Active connections: $established" -ForegroundColor White
    } else {
        Write-Warn "Gateway is NOT RUNNING"
    }

    Write-Host ""
}

# Show logs
function Show-Logs {
    if (Test-Path $GatewayLogFile) {
        Write-Host "===== Gateway Logs =====" -ForegroundColor Magenta
        Get-Content $GatewayLogFile -Tail 50
    } else {
        Write-Warn "Log file not found: $GatewayLogFile"
    }
}

# Show help
function Show-Help {
    Write-Host ""
    Write-Host "OpenClaw Gateway Control Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\gateway.ps1 [command]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  start    - Start the Gateway"
    Write-Host "  stop     - Stop the Gateway"
    Write-Host "  restart  - Restart the Gateway"
    Write-Host "  status   - Show Gateway status (default)"
    Write-Host "  logs     - Show recent Gateway logs"
    Write-Host "  help     - Show this help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\gateway.ps1 start"
    Write-Host "  .\gateway.ps1 status"
    Write-Host ""
}

# Main logic
switch ($Command.ToLower()) {
    "start" {
        Start-Gateway | Out-Null
        Show-Status
    }
    "stop" {
        Stop-Gateway | Out-Null
        Show-Status
    }
    "restart" {
        Stop-Gateway | Out-Null
        Start-Sleep -Seconds 2
        Start-Gateway | Out-Null
        Show-Status
    }
    "status" {
        Show-Status
    }
    "logs" {
        Show-Logs
    }
    "help" {
        Show-Help
    }
    default {
        Write-Err "Unknown command: $Command"
        Show-Help
    }
}
