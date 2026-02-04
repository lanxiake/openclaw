#Requires -Version 5.1
# WeChat Bridge - Gateway and Bridge start/stop script
# Usage: .\dev.ps1 [build|start|stop|restart|status|all|help]

param(
    [Parameter(Position = 0)]
    [string]$Command = "all"
)

$ErrorActionPreference = "Continue"

# Config
$ProjectRoot = "E:\open-source-project\openclaw-windows-exe"
$BridgeDir = "$ProjectRoot\wxauto-bridge"
$GatewayPort = 18789
$GatewayLogFile = "$env:TEMP\openclaw-gateway.log"

# Output functions
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-OK($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# Check if Gateway is listening (only LISTEN state)
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
    }
    if (-not (Test-GatewayRunning)) {
        Write-OK "Gateway stopped"
    } else {
        Write-Warn "Gateway port still in use"
    }
}

# Stop Bridge
function Stop-Bridge {
    Write-Info "Stopping Bridge..."
    Get-Process -Name "python" -ErrorAction SilentlyContinue | ForEach-Object {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmdLine -match "bridge\.py") {
            Write-Info "Killing Python process (PID: $($_.Id))..."
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1
    Write-OK "Bridge stopped"
}

# Start Gateway
function Start-Gateway {
    Write-Info "Starting Gateway..."
    if (Test-GatewayRunning) {
        $proc = Get-GatewayProcess
        Write-Warn "Gateway already running (PID: $($proc.Id))"
        return $true
    }
    Push-Location $ProjectRoot
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm openclaw gateway run --bind loopback --port $GatewayPort --force > `"$GatewayLogFile`" 2>&1" -WindowStyle Hidden -WorkingDirectory $ProjectRoot
    Pop-Location
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
        Write-Err "Gateway failed to start, check log: $GatewayLogFile"
        return $false
    }
}

# Start Bridge
function Start-Bridge {
    Write-Info "Starting Bridge..."
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCmd) {
        Write-Err "Python not found"
        return $false
    }
    Start-Process -FilePath "python" -ArgumentList "bridge.py", "-v" -WorkingDirectory $BridgeDir
    Start-Sleep -Seconds 2
    Write-OK "Bridge started"
    return $true
}

# Build project
function Build-Project {
    Write-Info "Building OpenClaw project..."
    Push-Location $ProjectRoot
    & pnpm build
    $result = $LASTEXITCODE
    Pop-Location
    if ($result -ne 0) {
        Write-Err "Build failed"
        return $false
    }
    Write-OK "Build successful"
    return $true
}

# Show status
function Show-Status {
    Write-Host ""
    Write-Host "===== Service Status =====" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "[Gateway]" -ForegroundColor Yellow
    if (Test-GatewayRunning) {
        $proc = Get-GatewayProcess
        Write-OK "Running - Port: $GatewayPort, PID: $($proc.Id)"
    } else {
        Write-Warn "Not running"
    }
    Write-Host ""
    Write-Host "[Bridge]" -ForegroundColor Yellow
    $found = $false
    Get-Process -Name "python" -ErrorAction SilentlyContinue | ForEach-Object {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmdLine -match "bridge\.py") {
            Write-OK "Running - PID: $($_.Id)"
            $script:found = $true
        }
    }
    if (-not $found) {
        Write-Warn "Not running"
    }
    Write-Host ""
}

# Show help
function Show-Help {
    Write-Host ""
    Write-Host "WeChat Bridge Dev Script (PowerShell)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\dev.ps1 [command]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  build     - Build OpenClaw project"
    Write-Host "  start     - Start Gateway and Bridge"
    Write-Host "  stop      - Stop Gateway and Bridge"
    Write-Host "  restart   - Restart Gateway and Bridge"
    Write-Host "  status    - Show service status"
    Write-Host "  all       - Build and restart all (default)"
    Write-Host "  help      - Show this help"
    Write-Host ""
}

# Main logic
switch ($Command) {
    "build" { Build-Project | Out-Null }
    "start" { Start-Gateway | Out-Null; Start-Bridge | Out-Null; Show-Status }
    "stop" { Stop-Bridge; Stop-Gateway; Show-Status }
    "restart" { Stop-Bridge; Stop-Gateway; Start-Sleep -Seconds 2; Start-Gateway | Out-Null; Start-Bridge | Out-Null; Show-Status }
    "status" { Show-Status }
    "all" { if (Build-Project) { Stop-Bridge; Stop-Gateway; Start-Sleep -Seconds 2; Start-Gateway | Out-Null; Start-Bridge | Out-Null; Show-Status; Write-Info "Dev environment ready" } }
    "help" { Show-Help }
    default { Write-Err "Unknown command: $Command"; Show-Help }
}
