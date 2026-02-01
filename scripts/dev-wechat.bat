@echo off
REM OpenClaw WeChat 开发环境启停脚本
REM 用法: dev-wechat.bat [start|stop|restart|status|logs]
REM 可以从任何目录运行

setlocal

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
REM 去掉末尾的反斜杠
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
REM 获取项目根目录（脚本目录的父目录）
for %%I in ("%SCRIPT_DIR%") do set "PROJECT_ROOT=%%~dpI"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

REM 切换到项目根目录
cd /d "%PROJECT_ROOT%"

if "%1"=="" (
    powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\dev-wechat.ps1" start
) else (
    powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\dev-wechat.ps1" %1
)

endlocal
