# 临时启动脚本 - 使用 wechat 插件 token
# 停止之前的 Bridge
Get-Process -Name "python" -ErrorAction SilentlyContinue | ForEach-Object {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    if ($cmdLine -match "bridge\.py") {
        Write-Host "[INFO] Killing Python process (PID: $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1

# 使用 wechat 插件生成的 token 启动 Bridge
$token = "d50698525a214bdbaca1f7a1e9ae7868"
$pythonExe = "C:\Users\75791\AppData\Local\Programs\Python\Python312\python.exe"
$bridgeDir = "D:\AI-workspace\openclaw\wxauto-bridge"

Write-Host "[INFO] Starting Bridge with wechat token: $token"
Start-Process -FilePath $pythonExe -ArgumentList "bridge.py", "--gateway", "ws://localhost:18789", "--token", $token, "-v" -WorkingDirectory $bridgeDir
Start-Sleep -Seconds 5

# 检查 Gateway 日志确认连接
Write-Host "`n[INFO] Checking Gateway log for bridge connection..."
Get-Content "$env:TEMP\openclaw-gateway.log" -Tail 10 | Select-String -Pattern "Bridge|connected|wechat"
