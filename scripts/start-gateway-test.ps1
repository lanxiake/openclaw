# OpenClaw Gateway 启动测试脚本
# 用途：启动网关服务并验证其运行状态

param(
    [switch]$Clean = $false,
    [int]$Port = 18789,
    [string]$Bind = "loopback",
    [switch]$Verbose = $false
)

Write-Host "=== 启动 OpenClaw Gateway 测试环境 ===" -ForegroundColor Cyan
Write-Host "配置参数:" -ForegroundColor Gray
Write-Host "  - 端口: $Port" -ForegroundColor Gray
Write-Host "  - 绑定模式: $Bind" -ForegroundColor Gray
Write-Host "  - 清理环境: $Clean" -ForegroundColor Gray
Write-Host "  - 详细日志: $Verbose" -ForegroundColor Gray
Write-Host ""

# 清理环境
if ($Clean) {
    Write-Host "[步骤 1/5] 清理旧环境..." -ForegroundColor Yellow

    # 停止网关服务
    Write-Host "  停止网关服务..." -ForegroundColor Gray
    try {
        pnpm openclaw gateway stop --json | Out-Null
        Start-Sleep -Seconds 2
        Write-Host "  ✓ 网关服务已停止" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ 停止服务时出现警告（可能未运行）" -ForegroundColor Yellow
    }

    # 清理日志文件
    Write-Host "  清理日志文件..." -ForegroundColor Gray
    if (Test-Path "logs/gateway.log") {
        Remove-Item "logs/gateway.log" -Force
        Write-Host "  ✓ 已删除 logs/gateway.log" -ForegroundColor Green
    }

    if (Test-Path "logs/.pids/gateway.pid") {
        Remove-Item "logs/.pids/gateway.pid" -Force
        Write-Host "  ✓ 已删除 logs/.pids/gateway.pid" -ForegroundColor Green
    }

    # 清理临时文件
    if (Test-Path "$env:TEMP\openclaw") {
        Write-Host "  清理临时文件..." -ForegroundColor Gray
        Remove-Item "$env:TEMP\openclaw" -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
} else {
    Write-Host "[步骤 1/5] 跳过环境清理（使用 -Clean 参数启用）" -ForegroundColor Gray
    Write-Host ""
}

# 检查端口占用
Write-Host "[步骤 2/5] 检查端口占用..." -ForegroundColor Yellow
$existingPort = netstat -ano | Select-String ":$Port"
if ($existingPort) {
    Write-Host "  ✗ 端口 $Port 已被占用" -ForegroundColor Red
    Write-Host "  $existingPort" -ForegroundColor Gray

    # 提取 PID 并询问是否终止
    $pid = ($existingPort -split '\s+')[-1]
    Write-Host ""
    $response = Read-Host "是否终止占用端口的进程 (PID: $pid)? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        try {
            Stop-Process -Id $pid -Force
            Write-Host "  ✓ 进程已终止" -ForegroundColor Green
            Start-Sleep -Seconds 2
        } catch {
            Write-Host "  ✗ 无法终止进程: $_" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  请手动释放端口或使用其他端口" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "  ✓ 端口 $Port 可用" -ForegroundColor Green
Write-Host ""

# 构建命令参数
$gatewayArgs = @(
    "openclaw",
    "gateway",
    "run",
    "--bind", $Bind,
    "--port", $Port,
    "--force"
)

if ($Verbose) {
    $gatewayArgs += "--verbose"
}

$commandString = "pnpm " + ($gatewayArgs -join " ")

# 启动网关
Write-Host "[步骤 3/5] 启动网关服务..." -ForegroundColor Yellow
Write-Host "  执行命令: $commandString" -ForegroundColor Gray

# 在新窗口启动网关
$gatewayProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $commandString -PassThru
Write-Host "  ✓ 网关进程已启动 (PID: $($gatewayProcess.Id))" -ForegroundColor Green
Write-Host ""

# 等待启动
Write-Host "[步骤 4/5] 等待网关启动..." -ForegroundColor Yellow
$maxWaitSeconds = 15
$waitedSeconds = 0
$isReady = $false

while ($waitedSeconds -lt $maxWaitSeconds) {
    Start-Sleep -Seconds 1
    $waitedSeconds++

    # 检查端口是否开始监听
    $port = netstat -ano | Select-String ":$Port.*LISTENING"
    if ($port) {
        $isReady = $true
        Write-Host "  ✓ 网关已开始监听端口 (等待 $waitedSeconds 秒)" -ForegroundColor Green
        break
    }

    Write-Host "  等待中... ($waitedSeconds/$maxWaitSeconds 秒)" -ForegroundColor Gray
}

if (-not $isReady) {
    Write-Host "  ✗ 网关启动超时" -ForegroundColor Red
    Write-Host "  请检查网关窗口的错误信息" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# 验证启动
Write-Host "[步骤 5/5] 验证网关状态..." -ForegroundColor Yellow

# 5.1 端口监听验证
Write-Host "  [5.1] 端口监听验证..." -ForegroundColor Gray
$portInfo = netstat -ano | Select-String ":$Port.*LISTENING"
if ($portInfo) {
    Write-Host "    ✓ 端口监听正常" -ForegroundColor Green
    Write-Host "    $portInfo" -ForegroundColor Gray
} else {
    Write-Host "    ✗ 端口未监听" -ForegroundColor Red
}

# 5.2 健康检查
Write-Host "  [5.2] 健康检查..." -ForegroundColor Gray
Start-Sleep -Seconds 2  # 再等待2秒确保服务完全就绪

try {
    $healthResult = pnpm openclaw gateway health --json 2>&1 | Out-String
    $health = $healthResult | ConvertFrom-Json

    if ($health.ok) {
        Write-Host "    ✓ 健康检查通过" -ForegroundColor Green
        Write-Host "    响应时间: $($health.durationMs) ms" -ForegroundColor Gray
    } else {
        Write-Host "    ✗ 健康检查失败" -ForegroundColor Red
    }
} catch {
    Write-Host "    ⚠ 健康检查异常（网关可能仍在初始化）" -ForegroundColor Yellow
    Write-Host "    错误: $_" -ForegroundColor Gray
}

# 5.3 进程状态
Write-Host "  [5.3] 进程状态..." -ForegroundColor Gray
try {
    $process = Get-Process -Id $gatewayProcess.Id -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "    ✓ 网关进程运行中" -ForegroundColor Green
        Write-Host "    PID: $($process.Id)" -ForegroundColor Gray
        Write-Host "    内存: $([math]::Round($process.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "    CPU 时间: $($process.TotalProcessorTime)" -ForegroundColor Gray
    } else {
        Write-Host "    ✗ 网关进程已退出" -ForegroundColor Red
    }
} catch {
    Write-Host "    ⚠ 无法获取进程信息" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 网关启动完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "网关信息:" -ForegroundColor Cyan
Write-Host "  - WebSocket URL: ws://127.0.0.1:$Port" -ForegroundColor Gray
Write-Host "  - 进程 PID: $($gatewayProcess.Id)" -ForegroundColor Gray
Write-Host "  - 日志文件: logs/gateway.log" -ForegroundColor Gray
Write-Host ""
Write-Host "下一步操作:" -ForegroundColor Cyan
Write-Host "  1. 查看网关日志: Get-Content logs/gateway.log -Tail 50 -Wait" -ForegroundColor Gray
Write-Host "  2. 测试健康检查: pnpm openclaw gateway health" -ForegroundColor Gray
Write-Host "  3. 运行集成测试: .\scripts\test-windows-client-integration.ps1" -ForegroundColor Gray
Write-Host "  4. 停止网关: pnpm openclaw gateway stop" -ForegroundColor Gray
Write-Host ""
