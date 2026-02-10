# 认证服务前后端集成测试脚本 (Windows)
# 用途: 测试用户认证和管理员认证服务的完整流程

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "认证服务前后端集成测试" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 设置测试环境变量
Write-Host "[1/4] 设置测试环境变量..." -ForegroundColor Green
$env:JWT_SECRET = "test-jwt-secret-key-at-least-32-characters-long-1234567890"
$env:ADMIN_JWT_SECRET = "admin-jwt-secret-key-at-least-32-characters-long-1234567890"
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/test_db"
$env:NODE_ENV = "test"

Write-Host "✓ JWT_SECRET: $($env:JWT_SECRET.Substring(0, 20))..." -ForegroundColor Yellow
Write-Host "✓ ADMIN_JWT_SECRET: $($env:ADMIN_JWT_SECRET.Substring(0, 20))..." -ForegroundColor Yellow
Write-Host "✓ NODE_ENV: $($env:NODE_ENV)" -ForegroundColor Yellow
Write-Host ""

# 创建测试日志文件
$logFile = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
Write-Host "测试日志文件: $logFile" -ForegroundColor Yellow
Write-Host ""

# 运行用户认证服务单元测试
Write-Host "[2/4] 运行用户认证服务单元测试..." -ForegroundColor Green
Write-Host "测试文件: src/assistant/auth/auth-service.test.ts" -ForegroundColor Yellow
pnpm test -- src/assistant/auth/auth-service.test.ts --reporter=verbose 2>&1 | Tee-Object -FilePath $logFile -Append
Write-Host ""

# 运行管理员认证服务单元测试
Write-Host "[3/4] 运行管理员认证服务单元测试..." -ForegroundColor Green
Write-Host "测试文件: src/assistant/admin-auth/admin-auth-service.test.ts" -ForegroundColor Yellow
pnpm test -- src/assistant/admin-auth/admin-auth-service.test.ts --reporter=verbose 2>&1 | Tee-Object -FilePath $logFile -Append
Write-Host ""

# 生成测试覆盖报告
Write-Host "[4/4] 生成测试覆盖报告..." -ForegroundColor Green
pnpm test:coverage -- src/assistant/auth/ src/assistant/admin-auth/ 2>&1 | Tee-Object -FilePath $logFile -Append
Write-Host ""

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "集成测试完成" -ForegroundColor Cyan
Write-Host "日志已保存到: $logFile" -ForegroundColor Yellow
Write-Host "===================================" -ForegroundColor Cyan
