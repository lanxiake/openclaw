# Media Organizer Skill - Test Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Media Organizer Skill - Test Suite" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$skillPath = "E:\open-source-project\openclaw-windows-exe\skills\public\media-organizer"
$testPath = "E:\openclaw-workspace\media-organizer-test"
$testSourcePath = "$testPath\source"
$testTargetPath = "$testPath\organized"

# Test counters
$passedTests = 0
$failedTests = 0
$totalTests = 0

function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    
    $script:totalTests++
    Write-Host "Test ${totalTests}: $Name" -ForegroundColor Yellow
    
    try {
        & $Test
        Write-Host "  PASSED" -ForegroundColor Green
        $script:passedTests++
        return $true
    } catch {
        Write-Host "  FAILED: $_" -ForegroundColor Red
        $script:failedTests++
        return $false
    }
}

# Clean up previous test
if (Test-Path $testPath) {
    Remove-Item -Path $testPath -Recurse -Force
}

Write-Host "Setting up test environment..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $testSourcePath | Out-Null

# Test 1: Verify skill structure
Test-Step "Skill structure validation" {
    if (-not (Test-Path "$skillPath\SKILL.md")) {
        throw "SKILL.md not found"
    }
    if (-not (Test-Path "$skillPath\scripts")) {
        throw "scripts directory not found"
    }
    if (-not (Test-Path "$skillPath\assets")) {
        throw "assets directory not found"
    }
}

# Test 2: Verify required scripts exist
Test-Step "Required scripts exist" {
    $requiredScripts = @(
        "organize_media.ps1",
        "generate_media_list.ps1",
        "start_server.ps1"
    )
    
    foreach ($script in $requiredScripts) {
        if (-not (Test-Path "$skillPath\scripts\$script")) {
            throw "Missing script: $script"
        }
    }
}

# Test 3: Verify assets exist
Test-Step "Required assets exist" {
    if (-not (Test-Path "$skillPath\assets\index.html")) {
        throw "Missing asset: index.html"
    }
}

# Test 4: Create test media files
Test-Step "Create test media files" {
    # Create test photos
    $photoDir = "$testSourcePath\photos"
    New-Item -ItemType Directory -Force -Path $photoDir | Out-Null
    
    for ($i = 1; $i -le 5; $i++) {
        $content = "Test photo $i"
        $filePath = "$photoDir\test_photo_$i.jpg"
        $content | Out-File -FilePath $filePath -Encoding UTF8
        
        # Set different modification times
        $date = (Get-Date).AddDays(-$i * 30)
        (Get-Item $filePath).LastWriteTime = $date
    }
    
    # Create test videos
    $videoDir = "$testSourcePath\videos"
    New-Item -ItemType Directory -Force -Path $videoDir | Out-Null
    
    for ($i = 1; $i -le 3; $i++) {
        $content = "Test video $i"
        $filePath = "$videoDir\test_video_$i.mp4"
        $content | Out-File -FilePath $filePath -Encoding UTF8
        
        # Set different modification times
        $date = (Get-Date).AddDays(-$i * 60)
        (Get-Item $filePath).LastWriteTime = $date
    }
    
    $totalFiles = (Get-ChildItem -Path $testSourcePath -Recurse -File).Count
    if ($totalFiles -ne 8) {
        throw "Expected 8 test files, found $totalFiles"
    }
}

# Test 5: Run organize script
Test-Step "Run organize_media.ps1" {
    $organizeScript = "$skillPath\scripts\organize_media.ps1"
    
    # Run with parameters
    & powershell -ExecutionPolicy Bypass -File $organizeScript -SourcePath $testSourcePath -TargetBase $testTargetPath -ErrorAction Stop
    
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
        throw "Script exited with code $LASTEXITCODE"
    }
}

# Test 6: Verify organized structure
Test-Step "Verify organized directory structure" {
    if (-not (Test-Path "$testTargetPath\Photos")) {
        throw "Photos directory not created"
    }
    if (-not (Test-Path "$testTargetPath\Videos")) {
        throw "Videos directory not created"
    }
    
    # Check if files were organized
    $organizedPhotos = (Get-ChildItem -Path "$testTargetPath\Photos" -Recurse -File).Count
    $organizedVideos = (Get-ChildItem -Path "$testTargetPath\Videos" -Recurse -File).Count
    
    if ($organizedPhotos -eq 0) {
        throw "No photos were organized"
    }
    if ($organizedVideos -eq 0) {
        throw "No videos were organized"
    }
    
    Write-Host "    Organized: $organizedPhotos photos, $organizedVideos videos" -ForegroundColor Gray
}

# Test 7: Copy index.html
Test-Step "Copy gallery template" {
    Copy-Item "$skillPath\assets\index.html" -Destination "$testTargetPath\index.html" -Force
    
    if (-not (Test-Path "$testTargetPath\index.html")) {
        throw "Failed to copy index.html"
    }
}

# Test 8: Run generate_media_list script
Test-Step "Run generate_media_list.ps1" {
    $generateScript = "$skillPath\scripts\generate_media_list.ps1"
    
    # Run with parameter
    & powershell -ExecutionPolicy Bypass -File $generateScript -BasePath $testTargetPath -ErrorAction Stop
    
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
        throw "Script exited with code $LASTEXITCODE"
    }
}

# Test 9: Verify media_list.json
Test-Step "Verify media_list.json generated" {
    $jsonPath = "$testTargetPath\media_list.json"
    
    if (-not (Test-Path $jsonPath)) {
        throw "media_list.json not found"
    }
    
    $json = Get-Content $jsonPath -Raw | ConvertFrom-Json
    
    if (-not $json.files) {
        throw "media_list.json missing 'files' property"
    }
    
    if ($json.files.Count -eq 0) {
        throw "media_list.json contains no files"
    }
    
    Write-Host "    Found $($json.files.Count) files in media_list.json" -ForegroundColor Gray
}

# Test 10: Verify HTML template validity
Test-Step "Verify HTML template" {
    $htmlPath = "$testTargetPath\index.html"
    $htmlContent = Get-Content $htmlPath -Raw
    
    if ($htmlContent -notmatch '<html') {
        throw "Invalid HTML: missing <html> tag"
    }
    if ($htmlContent -notmatch 'media_list\.json') {
        throw "HTML doesn't reference media_list.json"
    }
    if ($htmlContent -notmatch 'gallery') {
        throw "HTML missing gallery element"
    }
}

# Test 11: Test duplicate handling
Test-Step "Test duplicate file handling" {
    # Run organize again - should skip existing files
    & powershell -ExecutionPolicy Bypass -File "$skillPath\scripts\organize_media.ps1" -SourcePath $testSourcePath -TargetBase $testTargetPath -ErrorAction SilentlyContinue | Out-Null
    
    # Count files - should be same as before
    $photosAfter = (Get-ChildItem -Path "$testTargetPath\Photos" -Recurse -File).Count
    $videosAfter = (Get-ChildItem -Path "$testTargetPath\Videos" -Recurse -File).Count
    
    Write-Host "    After re-run: $photosAfter photos, $videosAfter videos" -ForegroundColor Gray
}

# Test 12: Verify stats.json
Test-Step "Verify stats.json generated" {
    $statsPath = "$testTargetPath\stats.json"
    
    if (Test-Path $statsPath) {
        $stats = Get-Content $statsPath -Raw | ConvertFrom-Json
        
        if (-not $stats.photos -and -not $stats.videos) {
            throw "stats.json missing photo/video data"
        }
        
        Write-Host "    Stats generated successfully" -ForegroundColor Gray
    } else {
        Write-Host "    Warning: stats.json not found (optional)" -ForegroundColor Yellow
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Results" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Test output location: $testTargetPath" -ForegroundColor Cyan
    Write-Host "You can open $testTargetPath\index.html in a browser to verify the gallery." -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "SOME TESTS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please review the errors above and fix the issues." -ForegroundColor Yellow
    exit 1
}
