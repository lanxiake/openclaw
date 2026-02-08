@echo off
echo === Restarting OpenClaw Windows Development Server ===

REM Kill all electron processes
echo Killing electron processes...
taskkill /F /IM electron.exe 2>nul

REM Kill all node processes that might be holding ports
echo Killing Vite dev servers on ports 5173-5175...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 :5174 :5175" ^| findstr "LISTENING"') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

REM Wait for processes to fully terminate
timeout /t 3 /nobreak >nul

REM Start dev server
echo Starting development server...
cd /d "E:\open-source-project\openclaw-windows-exe\apps\windows"
pnpm run dev
