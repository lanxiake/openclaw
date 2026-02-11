#Requires -Version 5.1
# WeChat Bridge - Gateway, UI and Bridge start/stop script
# Usage: .\dev.ps1 [build|start|stop|restart|status|all|help]

param(
    [Parameter(Position = 0)]
    [string]$Command = "all"
)

$ErrorActionPreference = "Continue"

# Config
$ProjectRoot = "D:\AI-workspace\openclaw"
$BridgeDir = "$ProjectRoot\wxauto-bridge"
$GatewayPort = 18789
$UIPort = 5173
$GatewayLogFile = "$env:TEMP\openclaw-gateway.log"
$UILogFile = "$env:TEMP\openclaw-ui.log"
$OpenClawConfigPath = Join-Path $env:USERPROFILE ".openclaw\openclaw.json"

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

# Check if UI is listening
function Test-UIRunning {
    $listening = Get-NetTCPConnection -LocalPort $UIPort -State Listen -ErrorAction SilentlyContinue
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

# Get UI process
function Get-UIProcess {
    $listening = Get-NetTCPConnection -LocalPort $UIPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listening -and $listening.OwningProcess -ne 0) {
        return Get-Process -Id $listening.OwningProcess -ErrorAction SilentlyContinue
    }
    return $null
}

# Read auth token from Gateway log or config
function Get-AuthToken {
    # 优先从环境变量获取
    $token = $env:WECHAT_AUTH_TOKEN
    if ($token) {
        Write-Info "Using auth token from WECHAT_AUTH_TOKEN env"
        return $token
    }

    # 从 Gateway 日志中提取 wechat 插件生成的 token
    if (Test-Path $GatewayLogFile) {
        $logContent = Get-Content $GatewayLogFile -Raw -ErrorAction SilentlyContinue
        if ($logContent -match "Generated auth token: ([a-f0-9]+)") {
            $token = $Matches[1]
            Write-Info "Using wechat auth token from Gateway log"
            return $token
        }
    }

    # 从配置文件获取
    if (Test-Path $OpenClawConfigPath) {
        try {
            $config = Get-Content $OpenClawConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
            # gateway.auth.token
            $token = $config.gateway.auth.token
            if ($token) {
                Write-Info "Using auth token from ~/.openclaw/openclaw.json (gateway.auth.token)"
                return $token
            }
        } catch {
            Write-Warn "Failed to read config, trying Gateway log..."
        }
    }

    Write-Warn "No auth token found"
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

# Stop UI
function Stop-UI {
    Write-Info "Stopping UI..."
    $proc = Get-UIProcess
    if ($proc) {
        Write-Info "Killing UI process (PID: $($proc.Id))..."
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
    Write-OK "UI stopped"
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
    $timeout = 60
    $elapsed = 0
    while (-not (Test-GatewayRunning) -and ($elapsed -lt $timeout)) {
        Start-Sleep -Seconds 1
        $elapsed++
        if ($elapsed % 10 -eq 0) {
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

# Start UI
function Start-UI {
    Write-Info "Starting UI (Vite dev server)..."
    if (Test-UIRunning) {
        $proc = Get-UIProcess
        Write-Warn "UI already running (PID: $($proc.Id))"
        return $true
    }
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm ui:dev > `"$UILogFile`" 2>&1" -WindowStyle Hidden -WorkingDirectory $ProjectRoot
    Write-Info "Waiting for UI to start..."
    $timeout = 30
    $elapsed = 0
    while (-not (Test-UIRunning) -and ($elapsed -lt $timeout)) {
        Start-Sleep -Seconds 1
        $elapsed++
        if ($elapsed % 10 -eq 0) {
            Write-Info "Still waiting... ($elapsed seconds)"
        }
    }
    if (Test-UIRunning) {
        $proc = Get-UIProcess
        Write-OK "UI started (PID: $($proc.Id), http://localhost:$UIPort)"
        return $true
    } else {
        Write-Err "UI failed to start, check log: $UILogFile"
        return $false
    }
}

# Start Bridge
function Start-Bridge {
    Write-Info "Starting Bridge..."
    # 优先使用本地安装的 Python 3.12
    $pythonExe = "C:\Users\75791\AppData\Local\Programs\Python\Python312\python.exe"
    if (-not (Test-Path $pythonExe)) {
        $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
        if (-not $pythonCmd) {
            Write-Err "Python not found"
            return $false
        }
        $pythonExe = $pythonCmd.Source
    }
    Write-Info "Using Python: $pythonExe"

    # Get auth token
    $token = Get-AuthToken

    $args = @("bridge.py", "--gateway", "ws://localhost:$GatewayPort", "-v")
    if ($token) { $args += "--token"; $args += $token }

    Start-Process -FilePath $pythonExe -ArgumentList $args -WorkingDirectory $BridgeDir
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
    Write-Host "[UI]" -ForegroundColor Yellow
    if (Test-UIRunning) {
        $proc = Get-UIProcess
        Write-OK "Running - http://localhost:$UIPort, PID: $($proc.Id)"
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
    Write-Host "  start     - Start Gateway, UI and Bridge"
    Write-Host "  stop      - Stop Gateway, UI and Bridge"
    Write-Host "  restart   - Restart Gateway, UI and Bridge"
    Write-Host "  status    - Show service status"
    Write-Host "  all       - Build and restart all (default)"
    Write-Host "  help      - Show this help"
    Write-Host ""
}

# Main logic
switch ($Command) {
    "build" { Build-Project | Out-Null }
    "start" { Start-Gateway | Out-Null; Start-UI | Out-Null; Start-Bridge | Out-Null; Show-Status }
    "stop" { Stop-Bridge; Stop-UI; Stop-Gateway; Show-Status }
    "restart" { Stop-Bridge; Stop-UI; Stop-Gateway; Start-Sleep -Seconds 2; Start-Gateway | Out-Null; Start-UI | Out-Null; Start-Bridge | Out-Null; Show-Status }
    "status" { Show-Status }
    "all" { if (Build-Project) { Stop-Bridge; Stop-UI; Stop-Gateway; Start-Sleep -Seconds 2; Start-Gateway | Out-Null; Start-UI | Out-Null; Start-Bridge | Out-Null; Show-Status; Write-Info "Dev environment ready" } }
    "help" { Show-Help }
    default { Write-Err "Unknown command: $Command"; Show-Help }
}
