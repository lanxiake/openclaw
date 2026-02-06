# Generate media list JSON file for web gallery

param(
    [string]$BasePath = "E:\Photos-Videos"
)

$outputFile = "$BasePath\media_list.json"

Write-Host "Scanning media files from: $BasePath" -ForegroundColor Green

$mediaList = @{
    files = @()
    generated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

# Scan photos
$photoPath = "$BasePath\Photos"
if (Test-Path $photoPath) {
    Get-ChildItem -Path $photoPath -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Replace($BasePath, "").Replace("\", "/")
        $mediaList.files += @{
            name = $_.Name
            path = $relativePath
            type = "photo"
            year = $_.LastWriteTime.Year.ToString()
            month = $_.LastWriteTime.ToString("MM")
            date = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            size = $_.Length
        }
    }
}

# Scan videos
$videoPath = "$BasePath\Videos"
if (Test-Path $videoPath) {
    Get-ChildItem -Path $videoPath -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Replace($BasePath, "").Replace("\", "/")
        $mediaList.files += @{
            name = $_.Name
            path = $relativePath
            type = "video"
            year = $_.LastWriteTime.Year.ToString()
            month = $_.LastWriteTime.ToString("MM")
            date = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            size = $_.Length
        }
    }
}

# Sort by date
$mediaList.files = $mediaList.files | Sort-Object -Property date -Descending

# Save JSON
$mediaList | ConvertTo-Json -Depth 3 | Out-File $outputFile -Encoding UTF8

Write-Host "Media list generated: $outputFile" -ForegroundColor Green
Write-Host "Total files: $($mediaList.files.Count)" -ForegroundColor Cyan
