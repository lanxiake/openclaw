@echo off
REM ========================================
REM   微信桥接器 - 打包脚本
REM   使用 PyInstaller 打包为单个 exe 文件
REM ========================================
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   微信桥接器打包脚本
echo ========================================
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

REM 检查 Python 是否安装
echo [1/5] 检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    echo        下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VER=%%i
echo        Python 版本: %PYTHON_VER%

REM 安装项目依赖
echo.
echo [2/5] 安装项目依赖...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)
echo        依赖安装完成

REM 安装 PyInstaller
echo.
echo [3/5] 安装 PyInstaller...
pip install pyinstaller -q
if errorlevel 1 (
    echo [错误] PyInstaller 安装失败
    pause
    exit /b 1
)
echo        PyInstaller 已就绪

REM 清理旧的构建文件
echo.
echo [4/5] 清理旧构建文件...
if exist build rmdir /s /q build
if exist dist\wxauto-bridge.exe del /f /q dist\wxauto-bridge.exe
echo        清理完成

REM 执行打包
echo.
echo [5/5] 打包中（可能需要几分钟）...
pyinstaller build.spec --noconfirm --clean
if errorlevel 1 (
    echo [错误] 打包失败，请检查错误信息
    pause
    exit /b 1
)

echo.
echo ========================================
echo   打包完成!
echo ========================================
echo.

REM 显示输出文件信息
if exist dist\wxauto-bridge.exe (
    echo 输出文件: dist\wxauto-bridge.exe
    for %%A in (dist\wxauto-bridge.exe) do (
        set SIZE=%%~zA
        set /a SIZE_MB=!SIZE!/1024/1024
        echo 文件大小: !SIZE_MB! MB ^(!SIZE! bytes^)
    )
    echo.
    echo 使用方法:
    echo   1. 确保微信 PC 客户端已登录
    echo   2. 双击运行 dist\wxauto-bridge.exe
    echo   3. 在界面中配置 Gateway 地址和监听列表
) else (
    echo [警告] 未找到输出文件
)

echo.
pause
