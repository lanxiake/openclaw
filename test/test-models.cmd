@echo off
REM 模型测试脚本 (CMD版本)
REM 此脚本调用PowerShell执行实际的测试

echo ========================================
echo 模型可用性测试
echo ========================================
echo.

REM 获取脚本所在目录
set SCRIPT_DIR=%~dp0

REM 调用PowerShell脚本
powershell.exe -ExecutionPolicy Bypass -File "%SCRIPT_DIR%test-models.ps1"

REM 检查PowerShell执行结果
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo 错误: PowerShell脚本执行失败
    exit /b %ERRORLEVEL%
)

echo.
echo 测试完成
pause





