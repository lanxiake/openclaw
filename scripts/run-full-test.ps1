# OpenClaw Windows 客户端完整测试流程
# 用途：自动化执行完整的测试流程

param(
    [switch]$Clean = $false,
    [switch]$SkipEnvCheck = $false,
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false,
    [int]$Port = 18789
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenClaw Windows 客户端完整测试流程" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

# 阶段 1：环境检查
if (-not $SkipEnvCheck) {
    Write-Host "=== 阶段 1/3: 环境检查 ===" -ForegroundColor Cyan
    Write-Host ""

    & ".\scripts\test-gateway-env.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "环境检查失败，请解决上述问题后重试" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "环境检查通过" -ForegroundColor Green
    Write-Host ""
    Start-Sleep -Seconds 2
}

# 阶段 2：启动网关
Write-Host "=== 阶段 2/3: 启动网关服务 ===" -ForegroundColor Cyan
Write-Host ""

$gatewayArgs = @("-Port", $Port, "-Bind", "loopback")
if ($Clean) { $gatewayArgs += "-Clean" }
if ($Verbose) { $gatewayArgs += "-Verbose" }

& ".\scripts\start-gateway-test.ps1" @gatewayArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "网关启动失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "网关服务已启动" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 3

# 阶段 3：运行集成测试
Write-Host "=== 阶段 3/3: 运行集成测试 ===" -ForegroundColor Cyan
Write-Host ""

$testArgs = @("-GatewayUrl", "ws://127.0.0.1:$Port")
if ($SkipBuild) { $testArgs += "-SkipBuild" }
if ($Verbose) { $testArgs += "-Verbose" }

$testPassed = $false
& ".\scripts\test-windows-client-integration.ps1" @testArgs
if ($LASTEXITCODE -eq 0) {
    $testPassed = $true
}

Write-Host ""
if ($testPassed) {
    Write-Host "集成测试通过" -ForegroundColor Green
} else {
    Write-Host "集成测试失败" -ForegroundColor Red
}
Write-Host ""

# 生成测试报告
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  测试完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "总耗时: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor Gray
Write-Host "测试结果: $(if ($testPassed) { 'PASSED' } else { 'FAILED' })" -ForegroundColor $(if ($testPassed) { "Green" } else { "Red" })
Write-Host ""

if ($testPassed) {
    Write-Host "所有测试通过！" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步操作:" -ForegroundColor Cyan
    Write-Host "  1. 启动 Windows 客户端: cd apps/windows && pnpm dev" -ForegroundColor Gray
    Write-Host "  2. 查看网关日志: Get-Content logs/gateway.log -Tail 50 -Wait" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "测试失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "故障排查步骤:" -ForegroundColor Yellow
    Write-Host "  1. 查看网关日志: Get-Content logs/gateway.log -Tail 100" -ForegroundColor Gray
    Write-Host "  2. 检查网关状态: pnpm openclaw gateway status" -ForegroundColor Gray
    Write-Host "  3. 重新运行测试: .\scripts\run-full-test.ps1 -Clean -Verbose" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
