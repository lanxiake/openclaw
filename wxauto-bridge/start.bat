@echo off
REM ========================================
REM   微信桥接器 - 启动脚本
REM   启动打包后的 exe 文件
REM ========================================
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   微信桥接器启动脚本
echo ========================================
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

REM 检查 exe 文件是否存在
set EXE_PATH=dist\wxauto-bridge.exe
if not exist "%EXE_PATH%" (
    echo [错误] 未找到 %EXE_PATH%
    echo        请先运行 package.bat 进行打包
    echo.
    pause
    exit /b 1
)

REM 检查微信是否运行
echo [检查] 微信客户端状态...
tasklist /fi "imagename eq WeChat.exe" 2>nul | find /i "WeChat.exe" >nul
if errorlevel 1 (
    echo [警告] 微信客户端未运行
    echo        请先启动微信 PC 客户端并登录
    echo.
    set /p CONTINUE="是否继续启动? (Y/N): "
    if /i not "!CONTINUE!"=="Y" exit /b 0
) else (
    echo        微信客户端已运行
)

REM 启动程序
echo.
echo [启动] 正在启动微信桥接器...
start "" "%EXE_PATH%"

echo.
echo 微信桥接器已启动
echo 配置文件位置: %USERPROFILE%\.openclaw\wechat-bridge.json
echo.
pause
