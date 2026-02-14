# 添加 Windows Defender 排除项
# 需要管理员权限运行

param(
    [switch]$Remove
)

$ErrorActionPreference = "Stop"

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 此脚本需要管理员权限" -ForegroundColor Red
    Write-Host "请右键点击脚本，选择'以管理员身份运行'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Windows Defender 排除项管理工具                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 获取当前脚本所在目录的上级目录（windows 目录）
$projectRoot = Split-Path -Parent $PSScriptRoot

# 需要排除的目录
$exclusions = @(
    "$projectRoot\release",
    "$projectRoot\out",
    "$env:LOCALAPPDATA\electron-builder\Cache",
    "$env:LOCALAPPDATA\Temp"
)

# 需要排除的进程
$processExclusions = @(
    "electron.exe",
    "rcedit-x64.exe"
)

if ($Remove) {
    Write-Host "🗑️  移除 Windows Defender 排除项..." -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($path in $exclusions) {
        if (Test-Path $path) {
            try {
                Remove-MpPreference -ExclusionPath $path -ErrorAction SilentlyContinue
                Write-Host "  ✓ 已移除目录: $path" -ForegroundColor Green
            } catch {
                Write-Host "  ℹ 跳过: $path" -ForegroundColor Gray
            }
        }
    }
    
    foreach ($process in $processExclusions) {
        try {
            Remove-MpPreference -ExclusionProcess $process -ErrorAction SilentlyContinue
            Write-Host "  ✓ 已移除进程: $process" -ForegroundColor Green
        } catch {
            Write-Host "  ℹ 跳过: $process" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "✅ 排除项已移除" -ForegroundColor Green
} else {
    Write-Host "➕ 添加 Windows Defender 排除项..." -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "📂 添加目录排除项:" -ForegroundColor Cyan
    foreach ($path in $exclusions) {
        try {
            # 如果目录不存在，先创建
            if (-not (Test-Path $path)) {
                New-Item -ItemType Directory -Path $path -Force | Out-Null
            }
            
            Add-MpPreference -ExclusionPath $path -ErrorAction Stop
            Write-Host "  ✓ $path" -ForegroundColor Green
        } catch {
            Write-Host "  ✗ $path - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "🔧 添加进程排除项:" -ForegroundColor Cyan
    foreach ($process in $processExclusions) {
        try {
            Add-MpPreference -ExclusionProcess $process -ErrorAction Stop
            Write-Host "  ✓ $process" -ForegroundColor Green
        } catch {
            Write-Host "  ✗ $process - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "✅ 排除项添加完成！" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 后续步骤:" -ForegroundColor Yellow
    Write-Host "  1. 运行: pnpm package:win" -ForegroundColor White
    Write-Host "  2. 打包完成后，可以运行此脚本移除排除项:" -ForegroundColor White
    Write-Host "     .\scripts\add-defender-exclusion.ps1 -Remove" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "💡 提示: 当前排除项列表:" -ForegroundColor Cyan
try {
    $currentExclusions = Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
    if ($currentExclusions) {
        foreach ($ex in $currentExclusions) {
            if ($ex -match "openclaw|electron|builder") {
                Write-Host "  • $ex" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Host "  无法获取当前排除项" -ForegroundColor Gray
}

Write-Host ""
pause
