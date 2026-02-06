# Media File Organizer Script
# Organize photos and videos by date

param(
    [string]$SourcePath = "E:\",
    [string]$TargetBase = "E:\Photos-Videos"
)

$photoExts = @('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic')
$videoExts = @('.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.m4v', '.3gp')

# Create base directories
New-Item -ItemType Directory -Force -Path $TargetBase | Out-Null
New-Item -ItemType Directory -Force -Path "$TargetBase\Photos" | Out-Null
New-Item -ItemType Directory -Force -Path "$TargetBase\Videos" | Out-Null

Write-Host "Scanning media files from: $SourcePath" -ForegroundColor Green

# Find all media files
$allExts = $photoExts + $videoExts
$files = Get-ChildItem -Path $SourcePath -Include ($allExts | ForEach-Object { "*$_" }) -Recurse -File -ErrorAction SilentlyContinue | 
    Where-Object { $_.FullName -notlike "$TargetBase\*" }

Write-Host "Found $($files.Count) media files" -ForegroundColor Cyan

$copiedCount = 0
$skippedCount = 0
$errorCount = 0

foreach ($file in $files) {
    try {
        $date = $file.LastWriteTime
        $year = $date.Year
        $month = $date.ToString("MM")
        
        $isPhoto = $photoExts -contains $file.Extension.ToLower()
        $mediaType = if ($isPhoto) { "Photos" } else { "Videos" }
        
        $yearMonthDir = "$TargetBase\$mediaType\$year\$year-$month"
        New-Item -ItemType Directory -Force -Path $yearMonthDir | Out-Null
        
        $destPath = Join-Path $yearMonthDir $file.Name
        
        if (Test-Path $destPath) {
            $existingFile = Get-Item $destPath
            if ($existingFile.Length -eq $file.Length) {
                Write-Host "Skipped (exists): $($file.Name)" -ForegroundColor Yellow
                $skippedCount++
                continue
            } else {
                $timestamp = $date.ToString("HHmmss")
                $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                $ext = $file.Extension
                $destPath = Join-Path $yearMonthDir "${nameWithoutExt}_${timestamp}${ext}"
            }
        }
        
        Copy-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "Copied: $($file.Name)" -ForegroundColor Green
        $copiedCount++
        
    } catch {
        Write-Host "Error: $($file.FullName) - $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "Organization complete!" -ForegroundColor Green
Write-Host "Copied: $copiedCount files" -ForegroundColor Cyan
Write-Host "Skipped: $skippedCount files" -ForegroundColor Yellow
Write-Host "Errors: $errorCount files" -ForegroundColor Red

# Generate statistics
$stats = @{
    photos = @{}
    videos = @{}
}

Get-ChildItem -Path "$TargetBase\Photos" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $yearMonth = $_.Directory.Name
    if (-not $stats.photos.ContainsKey($yearMonth)) {
        $stats.photos[$yearMonth] = 0
    }
    $stats.photos[$yearMonth]++
}

Get-ChildItem -Path "$TargetBase\Videos" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $yearMonth = $_.Directory.Name
    if (-not $stats.videos.ContainsKey($yearMonth)) {
        $stats.videos[$yearMonth] = 0
    }
    $stats.videos[$yearMonth]++
}

$stats | ConvertTo-Json -Depth 3 | Out-File "$TargetBase\stats.json" -Encoding UTF8

Write-Host ""
Write-Host "Stats saved to: $TargetBase\stats.json" -ForegroundColor Green
