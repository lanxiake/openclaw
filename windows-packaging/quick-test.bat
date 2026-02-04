@echo off
chcp 65001 >nul
title OpenClaw Windows 打包测试

echo ================================================================
echo   OpenClaw Windows 打包方案快速测试
echo ================================================================
echo.

:menu
echo 请选择要测试的打包方案:
echo.
echo   1. PKG 打包 (推荐 - CLI 应用)
echo   2. NEXE 打包 (轻量级)
echo   3. Electron 打包 (带 GUI 界面)
echo   4. 查看测试指南
echo   0. 退出
echo.
set /p choice="请输入选项 (0-4): "

if "%choice%"=="1" goto pkg_test
if "%choice%"=="2" goto nexe_test
if "%choice%"=="3" goto electron_test
if "%choice%"=="4" goto show_guide
if "%choice%"=="0" goto end

echo 无效选项，请重新选择
pause
cls
goto menu

:pkg_test
cls
echo ================================================================
echo   PKG 打包测试
echo ================================================================
echo.
cd pkg-test

echo [1/4] 检查 Node.js 版本...
node --version
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js >= 18
    pause
    goto menu
)

echo.
echo [2/4] 配置国内镜像源加速下载...
echo 设置淘宝 npm 镜像...
call npm config set registry https://registry.npmmirror.com >nul 2>&1
echo 设置 Node.js 二进制镜像...
call npm config set node_mirror https://npmmirror.com/mirrors/node/ >nul 2>&1
echo ✅ 镜像源配置完成

echo.
echo [3/4] 安装依赖...
call npm install fs-extra
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    cd ..
    goto menu
)

echo.
echo [4/4] 执行打包...
node build.js
if errorlevel 1 (
    echo [错误] 打包失败
    pause
    cd ..
    goto menu
)

echo.
echo ================================================================
echo   打包完成！是否立即测试运行？
echo ================================================================
set /p run="是否运行 dist\openclaw.exe? (Y/N): "
if /i "%run%"=="Y" (
    echo.
    echo 正在运行...
    dist\openclaw.exe
)

cd ..
pause
cls
goto menu

:nexe_test
cls
echo ================================================================
echo   NEXE 打包测试
echo ================================================================
echo.
cd nexe-test

echo [1/4] 检查 Node.js 版本...
node --version
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js >= 18
    pause
    goto menu
)

echo.
echo [2/4] 配置国内镜像源加速下载...
echo 设置淘宝 npm 镜像...
call npm config set registry https://registry.npmmirror.com >nul 2>&1
echo 设置 Node.js 二进制镜像...
call npm config set node_mirror https://npmmirror.com/mirrors/node/ >nul 2>&1
echo ✅ 镜像源配置完成

echo.
echo [3/4] 安装依赖...
call npm install fs-extra
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    cd ..
    goto menu
)

echo.
echo [4/4] 执行打包...
node build.js
if errorlevel 1 (
    echo [错误] 打包失败
    pause
    cd ..
    goto menu
)

echo.
echo ================================================================
echo   打包完成！是否立即测试运行？
echo ================================================================
set /p run="是否运行 dist\openclaw.exe? (Y/N): "
if /i "%run%"=="Y" (
    echo.
    echo 正在运行...
    dist\openclaw.exe
)

cd ..
pause
cls
goto menu

:electron_test
cls
echo ================================================================
echo   Electron 打包测试
echo ================================================================
echo.
echo 注意: Electron 打包需要较长时间（2-10分钟）
echo       首次打包需要下载约 100MB 依赖
echo       已配置国内淘宝镜像源加速下载
echo.
set /p confirm="确认继续? (Y/N): "
if /i not "%confirm%"=="Y" goto menu

cd electron-test

echo.
echo [1/3] 检查 Node.js 版本...
node --version
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js >= 18
    pause
    goto menu
)

echo.
echo [2/3] 配置国内镜像源加速下载...
echo 设置淘宝 npm 镜像...
call npm config set registry https://registry.npmmirror.com >nul 2>&1
echo 设置 Electron 镜像...
call npm config set electron_mirror https://npmmirror.com/mirrors/electron/ >nul 2>&1
echo 设置 Electron Builder 镜像...
call npm config set electron_builder_binaries_mirror https://npmmirror.com/mirrors/electron-builder-binaries/ >nul 2>&1
echo ✅ 镜像源配置完成

echo.
echo [3/3] 执行打包（这可能需要较长时间）...
node build.js
if errorlevel 1 (
    echo [错误] 打包失败
    echo.
    echo 可能的原因:
    echo   1. 网络连接问题
    echo   2. 磁盘空间不足
    echo   3. 防火墙拦截
    pause
    cd ..
    goto menu
)

echo.
echo ================================================================
echo   打包完成！选择测试方式:
echo ================================================================
echo   1. 开发模式运行 (npm start)
echo   2. 运行打包后的 exe
echo   0. 返回主菜单
echo.
set /p electron_choice="请选择 (0-2): "

if "%electron_choice%"=="1" (
    echo.
    echo 启动开发模式...
    call npm start
)

if "%electron_choice%"=="2" (
    echo.
    if exist "dist\win-unpacked\" (
        echo 运行打包后的应用...
        cd dist\win-unpacked
        for %%f in (*.exe) do (
            start "" "%%f"
            goto electron_done
        )
    ) else (
        echo 未找到打包文件，请先运行打包
    )
)

:electron_done
cd ..\..
pause
cls
goto menu

:show_guide
cls
type TEST-GUIDE.txt
pause
cls
goto menu

:end
echo.
echo 感谢使用 OpenClaw Windows 打包测试工具！
echo.
pause
