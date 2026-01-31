@echo off
REM 微信桥接器打包脚本
REM 使用 PyInstaller 将 Python 程序打包为单个可执行文件

echo ========================================
echo   微信桥接器打包脚本
echo ========================================
echo.

REM 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

REM 安装依赖
echo [1/3] 安装依赖...
pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

REM 安装 PyInstaller
echo.
echo [2/3] 安装 PyInstaller...
pip install pyinstaller
if errorlevel 1 (
    echo [错误] PyInstaller 安装失败
    pause
    exit /b 1
)

REM 打包
echo.
echo [3/3] 打包中...
pyinstaller --onefile --name wxauto-bridge --clean bridge.py
if errorlevel 1 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   打包完成!
echo   输出文件: dist\wxauto-bridge.exe
echo ========================================
echo.

REM 显示文件信息
if exist dist\wxauto-bridge.exe (
    echo 文件大小:
    for %%A in (dist\wxauto-bridge.exe) do echo   %%~zA bytes
)

echo.
pause
