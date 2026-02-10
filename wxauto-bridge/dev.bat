@echo off
REM WeChat Bridge 开发脚本
REM 用法: dev.bat [命令]
REM 命令: build, start, restart, stop, all

setlocal enabledelayedexpansion

set PROJECT_ROOT=D:\AI-workspace\openclaw
set BRIDGE_DIR=%PROJECT_ROOT%\wxauto-bridge

if "%1"=="" set CMD=all
if not "%1"=="" set CMD=%1

goto %CMD% 2>nul || goto help

:build
echo [INFO] 构建 OpenClaw 项目...
cd /d %PROJECT_ROOT%
call pnpm build
if %errorlevel% neq 0 (
    echo [ERROR] 构建失败
    exit /b 1
)
echo [OK] 构建成功
goto :eof

:stop
echo [INFO] 停止服务...
cd /d %PROJECT_ROOT%
call pnpm openclaw gateway stop 2>nul
taskkill /f /im python.exe /fi "WINDOWTITLE eq *bridge*" 2>nul
echo [OK] 服务已停止
goto :eof

:start
echo [INFO] 启动 Gateway...
cd /d %PROJECT_ROOT%
start /b pnpm openclaw gateway run --bind loopback --port 18789 --force
timeout /t 3 /nobreak >nul

echo [INFO] 启动 Bridge...
cd /d %BRIDGE_DIR%
start python bridge.py -v
timeout /t 2 /nobreak >nul
echo [OK] 服务已启动
goto :eof

:restart
call :stop
timeout /t 2 /nobreak >nul
call :start
goto :eof

:all
call :build
call :restart
echo [INFO] 开发环境已就绪，请在微信中发送测试消息
goto :eof

:help
echo.
echo WeChat Bridge 开发脚本
echo.
echo 用法: dev.bat [命令]
echo.
echo 命令:
echo   build     - 构建 OpenClaw 项目
echo   start     - 启动 Gateway 和 Bridge
echo   restart   - 重启 Gateway 和 Bridge
echo   stop      - 停止 Gateway 和 Bridge
echo   all       - 构建并重启所有服务 (默认)
echo   help      - 显示此帮助信息
echo.
goto :eof
\r