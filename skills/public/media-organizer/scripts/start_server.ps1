# 启动本地 HTTP 服务器用于浏览照片和视频

$port = 8080
$path = "E:\照片和视频"

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "照片和视频浏览服务器" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "服务器地址: http://localhost:$port" -ForegroundColor Yellow
Write-Host "文件路径: $path" -ForegroundColor Yellow
Write-Host ""
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Red
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# 使用 Python 的简单 HTTP 服务器
if (Get-Command python -ErrorAction SilentlyContinue) {
    Set-Location $path
    python -m http.server $port
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    Set-Location $path
    python3 -m http.server $port
} else {
    Write-Host "错误: 未找到 Python，尝试使用 Node.js..." -ForegroundColor Red
    
    if (Get-Command node -ErrorAction SilentlyContinue) {
        # 创建临时 Node.js 服务器
        $serverScript = @"
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = $port;
const BASE_PATH = '$($path.Replace('\', '\\'))';

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska'
};

const server = http.createServer((req, res) => {
    let filePath = path.join(BASE_PATH, req.url === '/' ? 'index.html' : req.url);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        const ext = path.extname(filePath);
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
});
"@
        $serverScript | Out-File "$env:TEMP\media_server.js" -Encoding UTF8
        node "$env:TEMP\media_server.js"
    } else {
        Write-Host "错误: 未找到 Python 或 Node.js" -ForegroundColor Red
        Write-Host "请安装 Python 或 Node.js 后重试" -ForegroundColor Yellow
    }
}
