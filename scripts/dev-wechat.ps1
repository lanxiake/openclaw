<#
.SYNOPSIS
    OpenClaw WeChat 开发环境启停脚本

.DESCRIPTION
    启动/停止 OpenClaw Gateway、UI 和 wxauto-bridge
    日志输出到 logs 目录

.EXAMPLE
    .\dev-wechat.ps1 start
    .\dev-wechat.ps1 stop
    .\dev-wechat.ps1 status
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "logs")]
    [string]$Action = "start"
)

# 配置
$GATEWAY_PORT = 18789
$UI_PORT = 5173

# 获取项目根目录
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
$ProjectRoot = Split-Path -Parent $ScriptDir
if (-not $ProjectRoot -or -not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    $ProjectRoot = (Get-Location).Path
}

# 日志目录
$LogDir = Join-Path $ProjectRoot "logs"
$PidDir = Join-Path $LogDir ".pids"

# 确保目录存在
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
if (-not (Test-Path $PidDir)) { New-Item -ItemType Directory -Path $PidDir -Force | Out-Null }

# 文件路径
$GatewayLog = Join-Path $LogDir "gateway.log"
$UILog = Join-Path $LogDir "ui.log"
$BridgeLog = Join-Path $LogDir "bridge.log"
$GatewayPid = Join-Path $PidDir "gateway.pid"
$UIPid = Join-Path $PidDir "ui.pid"
$BridgePid = Join-Path $PidDir "bridge.pid"

function Log([string]$msg, [string]$level = "INFO") {
    $ts = Get-Date -Format "HH:mm:ss"
    $color = @{ "INFO" = "Green"; "WARN" = "Yellow"; "ERROR" = "Red" }[$level]
    if (-not $color) { $color = "White" }
    Write-Host "[$ts] $msg" -ForegroundColor $color
}

function StopByPid([string]$pidFile, [string]$name) {
    if (Test-Path $pidFile) {
        $p = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($p) {
            $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
            if ($proc) {
                Log "Stopping $name (PID: $p)..."
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
            }
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

function StopByPort([int]$port, [string]$name) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Log "Stopping $name on port $port (PID: $($proc.Id))..."
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

function StartGateway {
    Log "Starting Gateway on port $GATEWAY_PORT..."
    StopByPid $GatewayPid "Gateway"
    StopByPort $GATEWAY_PORT "Gateway"

    $cmd = "cd '$ProjectRoot'; pnpm openclaw gateway run --bind loopback --port $GATEWAY_PORT --force --verbose 2>&1 | Tee-Object -FilePath '$GatewayLog'"
    $proc = Start-Process powershell -ArgumentList "-NoProfile", "-Command", $cmd -WindowStyle Hidden -PassThru
    $proc.Id | Out-File $GatewayPid -Force
    Log "Gateway started (PID: $($proc.Id))"
    Start-Sleep -Seconds 3
}

function StartUI {
    Log "Starting UI on port $UI_PORT..."
    StopByPid $UIPid "UI"
    StopByPort $UI_PORT "UI"

    $cmd = "cd '$ProjectRoot'; pnpm ui:dev 2>&1 | Tee-Object -FilePath '$UILog'"
    $proc = Start-Process powershell -ArgumentList "-NoProfile", "-Command", $cmd -WindowStyle Hidden -PassThru
    $proc.Id | Out-File $UIPid -Force
    Log "UI started (PID: $($proc.Id))"
    Start-Sleep -Seconds 2
}

function StartBridge {
    Log "Starting Bridge..."
    StopByPid $BridgePid "Bridge"

    $bridgeDir = Join-Path $ProjectRoot "wxauto-bridge"

    # 获取 auth token - 优先使用环境变量，否则从 Gateway 日志中提取
    $token = $env:WECHAT_AUTH_TOKEN
    if (-not $token -and (Test-Path $GatewayLog)) {
        # 等待 Gateway 生成 token
        $maxWait = 30
        $waited = 0
        while ($waited -lt $maxWait) {
            $logContent = Get-Content $GatewayLog -Raw -Encoding Unicode -ErrorAction SilentlyContinue
            if ($logContent -match "Generated auth token: ([a-f0-9]+)") {
                $token = $Matches[1]
                Log "Found auth token from Gateway log: $token"
                break
            }
            Start-Sleep -Seconds 1
            $waited++
        }
    }

    if (-not $token) {
        Log "Warning: No auth token found. Bridge may fail to connect." "WARN"
    }

    $tokenArg = if ($token) { "--token $token" } else { "" }

    $cmd = "cd '$bridgeDir'; python bridge.py --gateway ws://localhost:$GATEWAY_PORT -v $tokenArg 2>&1 | Tee-Object -FilePath '$BridgeLog'"
    $proc = Start-Process powershell -ArgumentList "-NoProfile", "-Command", $cmd -WindowStyle Hidden -PassThru
    $proc.Id | Out-File $BridgePid -Force
    Log "Bridge started (PID: $($proc.Id))"
}

function StopAll {
    Log "Stopping all services..."
    StopByPid $BridgePid "Bridge"
    StopByPid $UIPid "UI"
    StopByPid $GatewayPid "Gateway"
    StopByPort $GATEWAY_PORT "Gateway"
    StopByPort $UI_PORT "UI"

    # 清理 Python bridge 进程
    Get-Process python -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
            if ($cmdLine -like "*bridge.py*") {
                Log "Stopping Bridge Python process (PID: $($_.Id))..."
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }

    Log "All services stopped"
}

function ShowStatus {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  OpenClaw WeChat Development Status" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    # Gateway
    $gwProc = if (Test-Path $GatewayPid) { Get-Process -Id (Get-Content $GatewayPid) -ErrorAction SilentlyContinue } else { $null }
    $gwPort = Get-NetTCPConnection -LocalPort $GATEWAY_PORT -ErrorAction SilentlyContinue
    Write-Host "  Gateway:  " -NoNewline
    if ($gwProc -or $gwPort) {
        Write-Host "RUNNING" -ForegroundColor Green -NoNewline
        Write-Host " (port $GATEWAY_PORT)"
    } else {
        Write-Host "STOPPED" -ForegroundColor Red
    }

    # UI
    $uiProc = if (Test-Path $UIPid) { Get-Process -Id (Get-Content $UIPid) -ErrorAction SilentlyContinue } else { $null }
    $uiPort = Get-NetTCPConnection -LocalPort $UI_PORT -ErrorAction SilentlyContinue
    Write-Host "  UI:       " -NoNewline
    if ($uiProc -or $uiPort) {
        Write-Host "RUNNING" -ForegroundColor Green -NoNewline
        Write-Host " (port $UI_PORT)"
    } else {
        Write-Host "STOPPED" -ForegroundColor Red
    }

    # Bridge
    $brProc = if (Test-Path $BridgePid) { Get-Process -Id (Get-Content $BridgePid) -ErrorAction SilentlyContinue } else { $null }
    Write-Host "  Bridge:   " -NoNewline
    if ($brProc) {
        Write-Host "RUNNING" -ForegroundColor Green -NoNewline
        Write-Host " (PID $($brProc.Id))"
    } else {
        Write-Host "STOPPED" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "Log files:" -ForegroundColor Gray
    Write-Host "  Gateway:  $GatewayLog" -ForegroundColor Gray
    Write-Host "  UI:       $UILog" -ForegroundColor Gray
    Write-Host "  Bridge:   $BridgeLog" -ForegroundColor Gray
    Write-Host ""
    Write-Host "URLs:" -ForegroundColor Gray
    Write-Host "  UI:       http://localhost:$UI_PORT" -ForegroundColor Gray
    Write-Host "  Gateway:  ws://localhost:$GATEWAY_PORT" -ForegroundColor Gray
    Write-Host ""
}

function ShowLogs {
    Write-Host ""
    if (Test-Path $GatewayLog) {
        Write-Host "=== Gateway Log (last 20 lines) ===" -ForegroundColor Cyan
        Get-Content $GatewayLog -Tail 20 -ErrorAction SilentlyContinue
    }
    if (Test-Path $UILog) {
        Write-Host "`n=== UI Log (last 20 lines) ===" -ForegroundColor Cyan
        Get-Content $UILog -Tail 20 -ErrorAction SilentlyContinue
    }
    if (Test-Path $BridgeLog) {
        Write-Host "`n=== Bridge Log (last 20 lines) ===" -ForegroundColor Cyan
        Get-Content $BridgeLog -Tail 20 -ErrorAction SilentlyContinue
    }
}

# 主逻辑
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenClaw WeChat Development Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Project: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

switch ($Action) {
    "start" {
        StartGateway
        StartUI
        StartBridge
        ShowStatus
    }
    "stop" {
        StopAll
    }
    "restart" {
        StopAll
        Start-Sleep -Seconds 2
        StartGateway
        StartUI
        StartBridge
        ShowStatus
    }
    "status" {
        ShowStatus
    }
    "logs" {
        ShowLogs
    }
}
