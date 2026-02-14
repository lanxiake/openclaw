@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║      OpenClaw Windows 打包问题修复工具                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [√] 已获得管理员权限
) else (
    echo [!] 建议以管理员身份运行此脚本以获得最佳效果
    echo [!] 右键点击脚本，选择"以管理员身份运行"
    echo.
)

echo.
echo [1/5] 终止相关进程...
echo ────────────────────────────────────────────────────────────

taskkill /F /IM "OpenClaw Assistant.exe" >nul 2>&1
if %errorLevel% == 0 (
    echo   ✓ 已终止 OpenClaw Assistant.exe
) else (
    echo   ℹ OpenClaw Assistant.exe 未在运行
)

taskkill /F /IM electron.exe >nul 2>&1
if %errorLevel% == 0 (
    echo   ✓ 已终止 electron.exe
) else (
    echo   ℹ electron.exe 未在运行
)

taskkill /F /IM rcedit-x64.exe >nul 2>&1
if %errorLevel% == 0 (
    echo   ✓ 已终止 rcedit-x64.exe
) else (
    echo   ℹ rcedit-x64.exe 未在运行
)

echo   ⏳ 等待进程完全终止...
timeout /t 2 /nobreak >nul 2>&1
echo   ✓ 进程清理完成

echo.
echo [2/5] 清理输出目录...
echo ────────────────────────────────────────────────────────────

if exist "release" (
    rmdir /s /q "release" 2>nul
    if %errorLevel% == 0 (
        echo   ✓ 已删除 release 目录
    ) else (
        echo   ✗ 删除 release 目录失败 - 可能有文件被占用
        echo   提示: 请手动删除 release 目录后重试
    )
) else (
    echo   ℹ release 目录不存在
)

if exist "out" (
    rmdir /s /q "out" 2>nul
    if %errorLevel% == 0 (
        echo   ✓ 已删除 out 目录
    ) else (
        echo   ✗ 删除 out 目录失败
    )
) else (
    echo   ℹ out 目录不存在
)

echo.
echo [3/5] 清理 node_modules 缓存...
echo ────────────────────────────────────────────────────────────

if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache" 2>nul
    if %errorLevel% == 0 (
        echo   ✓ 已清理 node_modules\.cache
    ) else (
        echo   ⚠ 清理缓存失败（非致命）
    )
) else (
    echo   ℹ node_modules\.cache 不存在
)

echo.
echo [4/5] 清理 electron-builder 缓存...
echo ────────────────────────────────────────────────────────────

set "cache_dir=%LOCALAPPDATA%\electron-builder\Cache"
if exist "!cache_dir!" (
    echo   📍 缓存位置: !cache_dir!
    echo   ℹ 如需完全清理，可手动删除此目录
) else (
    echo   ℹ electron-builder 缓存不存在
)

echo.
echo [5/5] 检查环境...
echo ────────────────────────────────────────────────────────────

:: 检查 Node.js
where node >nul 2>&1
if %errorLevel% == 0 (
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set node_ver=%%i
    echo   ✓ Node.js: !node_ver!
) else (
    echo   ✗ 未找到 Node.js
)

:: 检查 pnpm
where pnpm >nul 2>&1
if %errorLevel% == 0 (
    for /f "tokens=*" %%i in ('pnpm --version 2^>nul') do set pnpm_ver=%%i
    echo   ✓ pnpm: !pnpm_ver!
) else (
    echo   ✗ 未找到 pnpm
)

echo.
echo ════════════════════════════════════════════════════════════
echo ✅ 清理完成！
echo ════════════════════════════════════════════════════════════
echo.
echo 📝 后续步骤:
echo   1. 运行: pnpm package:win
echo   2. 如果仍然失败，请以管理员身份运行此脚本
echo   3. 如有必要，临时禁用杀毒软件后重试
echo.
echo 💡 提示: 
echo   • 使用 pnpm package:win 会自动执行清理
echo   • 使用 pnpm clean 手动清理
echo   • 使用 pnpm clean:deep 深度清理
echo.

pause
