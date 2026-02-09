# OpenClaw Gateway 环境检查脚本
# 用途：检查网关运行所需的环境是否就绪

Write-Host "=== OpenClaw Gateway 环境检查 ===" -ForegroundColor Cyan

# 1. 检查 Node.js 版本
Write-Host "`n[1/5] 检查 Node.js 版本..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "  Node.js 版本: $nodeVersion" -ForegroundColor Green

# 2. 检查 pnpm 版本
Write-Host "`n[2/5] 检查 pnpm 版本..." -ForegroundColor Yellow
$pnpmVersion = pnpm --version
Write-Host "  pnpm 版本: $pnpmVersion" -ForegroundColor Green

# 3. 检查项目依赖
Write-Host "`n[3/5] 检查项目依赖..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  node_modules 目录存在" -ForegroundColor Green
} else {
    Write-Host "  node_modules 目录不存在，请运行: pnpm install" -ForegroundColor Red
    exit 1
}

# 4. 检查 TypeScript 编译
Write-Host "`n[4/5] 检查 TypeScript 编译..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Write-Host "  dist 目录存在" -ForegroundColor Green
} else {
    Write-Host "  dist 目录不存在，请运行: pnpm build" -ForegroundColor Red
    exit 1
}

# 5. 检查端口占用
Write-Host "`n[5/5] 检查端口 18789..." -ForegroundColor Yellow
$port = netstat -ano | Select-String ":18789"
if ($port) {
    Write-Host "  端口 18789 已被占用" -ForegroundColor Yellow
    Write-Host "  $port" -ForegroundColor Gray
} else {
    Write-Host "  端口 18789 空闲" -ForegroundColor Green
}

Write-Host "`n=== 环境检查完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作建议：" -ForegroundColor Cyan
Write-Host "  1. 启动网关测试: powershell -File .\scripts\start-gateway-test.ps1" -ForegroundColor Gray
Write-Host "  2. 运行集成测试: powershell -File .\scripts\test-windows-client-integration.ps1" -ForegroundColor Gray
Write-Host ""
