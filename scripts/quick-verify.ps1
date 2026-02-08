# OpenClaw 快速验证脚本 (Windows PowerShell)
#
# 用于快速验证项目核心功能
#
# 使用方式:
#   .\scripts\quick-verify.ps1              # 完整验证
#   .\scripts\quick-verify.ps1 -SkipTests   # 跳过测试
#   .\scripts\quick-verify.ps1 -SkipGateway # 跳过网关测试

param(
    [switch]$SkipTests,
    [switch]$SkipGateway,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenClaw Quick Verification Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date
$steps = @()

function Write-Step {
    param([string]$Step, [string]$Status, [string]$Color = "White")
    Write-Host "[$Status] $Step" -ForegroundColor $Color
}

function Add-Result {
    param([string]$Step, [bool]$Success, [string]$Message = "")
    $script:steps += @{
        Step = $Step
        Success = $Success
        Message = $Message
    }
}

# Step 1: 检查 Node.js 版本
Write-Step "Step 1: Checking Node.js version..." "..." "Yellow"
try {
    $nodeVersion = node --version
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -ge 22) {
        Write-Step "Node.js $nodeVersion" "OK" "Green"
        Add-Result "Node.js Version" $true
    } else {
        Write-Step "Node.js $nodeVersion (requires v22+)" "WARN" "Yellow"
        Add-Result "Node.js Version" $false "Requires v22+"
    }
} catch {
    Write-Step "Node.js not found" "FAIL" "Red"
    Add-Result "Node.js Version" $false "Not installed"
}

# Step 2: 检查 pnpm
Write-Step "Step 2: Checking pnpm..." "..." "Yellow"
try {
    $pnpmVersion = pnpm --version
    Write-Step "pnpm $pnpmVersion" "OK" "Green"
    Add-Result "pnpm" $true
} catch {
    Write-Step "pnpm not found" "FAIL" "Red"
    Add-Result "pnpm" $false "Not installed"
}

# Step 3: 类型检查
Write-Step "Step 3: Running TypeScript build..." "..." "Yellow"
try {
    $buildOutput = pnpm build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Step "TypeScript build passed" "OK" "Green"
        Add-Result "TypeScript Build" $true
    } else {
        Write-Step "TypeScript build failed" "FAIL" "Red"
        if ($Verbose) { Write-Host $buildOutput -ForegroundColor Gray }
        Add-Result "TypeScript Build" $false
    }
} catch {
    Write-Step "TypeScript build error: $_" "FAIL" "Red"
    Add-Result "TypeScript Build" $false $_.Exception.Message
}

# Step 4: Lint 检查
Write-Step "Step 4: Running linter..." "..." "Yellow"
try {
    $lintOutput = pnpm lint 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Step "Lint passed" "OK" "Green"
        Add-Result "Lint" $true
    } else {
        Write-Step "Lint warnings/errors found" "WARN" "Yellow"
        Add-Result "Lint" $false
    }
} catch {
    Write-Step "Lint error: $_" "WARN" "Yellow"
    Add-Result "Lint" $false
}

# Step 5: 单元测试
if (-not $SkipTests) {
    Write-Step "Step 5: Running unit tests..." "..." "Yellow"
    try {
        $testOutput = pnpm test -- --run --reporter=dot 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Step "Unit tests passed" "OK" "Green"
            Add-Result "Unit Tests" $true
        } else {
            Write-Step "Some tests failed" "WARN" "Yellow"
            if ($Verbose) { Write-Host $testOutput -ForegroundColor Gray }
            Add-Result "Unit Tests" $false
        }
    } catch {
        Write-Step "Test error: $_" "WARN" "Yellow"
        Add-Result "Unit Tests" $false
    }
} else {
    Write-Step "Step 5: Skipping unit tests" "SKIP" "Gray"
    Add-Result "Unit Tests" $true "Skipped"
}

# Step 6: 网关健康检查
if (-not $SkipGateway) {
    Write-Step "Step 6: Testing gateway health..." "..." "Yellow"
    try {
        $healthOutput = pnpm openclaw health 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Step "Gateway health check passed" "OK" "Green"
            Add-Result "Gateway Health" $true
        } else {
            Write-Step "Gateway health check failed (gateway may not be running)" "WARN" "Yellow"
            Add-Result "Gateway Health" $false "Gateway not running"
        }
    } catch {
        Write-Step "Gateway health check skipped" "WARN" "Yellow"
        Add-Result "Gateway Health" $false "Error"
    }
} else {
    Write-Step "Step 6: Skipping gateway test" "SKIP" "Gray"
    Add-Result "Gateway Health" $true "Skipped"
}

# 汇总结果
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

foreach ($step in $steps) {
    $icon = if ($step.Success) { "[PASS]" } else { "[FAIL]" }
    $color = if ($step.Success) { "Green" } else { "Red" }
    $msg = if ($step.Message) { " - $($step.Message)" } else { "" }
    Write-Host "$icon $($step.Step)$msg" -ForegroundColor $color
    if ($step.Success) { $passed++ } else { $failed++ }
}

Write-Host ""
Write-Host "Duration: $($duration.TotalSeconds.ToString('F1')) seconds" -ForegroundColor Gray
Write-Host "Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "All checks passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some checks failed. Review the output above." -ForegroundColor Yellow
    exit 1
}
