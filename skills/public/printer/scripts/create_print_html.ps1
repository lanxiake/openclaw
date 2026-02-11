# Create HTML Print Document from Images and Text
# Usage: .\create_print_html.ps1 -Output "output.html" [-Title "Title"] [-Images @("img1.jpg")] [-Texts @("text1")]

param(
    [Parameter(Mandatory=$true)]
    [string]$Output,
    
    [string]$Title = $null,
    
    [string[]]$Images = @(),
    
    [string[]]$Texts = @()
)

if ($Images.Count -eq 0 -and $Texts.Count -eq 0) {
    Write-Error "No content provided. Use -Images or -Texts"
    exit 1
}

# Create HTML content
$html = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>$Title</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
            page-break-inside: avoid;
        }
        p {
            line-height: 1.6;
            margin: 15px 0;
            text-align: justify;
        }
        @media print {
            body {
                margin: 0;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
"@

# Add title
if ($Title) {
    $html += "<h1>$Title</h1>`n"
}

# Add images
foreach ($imgPath in $Images) {
    try {
        $fullPath = Resolve-Path $imgPath -ErrorAction Stop
        # Convert to base64 for embedding
        $imageBytes = [System.IO.File]::ReadAllBytes($fullPath.Path)
        $base64 = [Convert]::ToBase64String($imageBytes)
        $ext = [System.IO.Path]::GetExtension($fullPath.Path).ToLower()
        $mimeType = switch ($ext) {
            ".jpg"  { "image/jpeg" }
            ".jpeg" { "image/jpeg" }
            ".png"  { "image/png" }
            ".gif"  { "image/gif" }
            default { "image/jpeg" }
        }
        $html += "<img src='data:$mimeType;base64,$base64' alt='Image' />`n"
    } catch {
        Write-Warning "Failed to add image $imgPath : $_"
    }
}

# Add texts
foreach ($text in $Texts) {
    $html += "<p>$text</p>`n"
}

$html += @"
</body>
</html>
"@

# Save HTML file
if ([System.IO.Path]::IsPathRooted($Output)) {
    $fullOutput = $Output
} else {
    $fullOutput = Join-Path (Get-Location) $Output
}
[System.IO.File]::WriteAllText($fullOutput, $html, [System.Text.Encoding]::UTF8)

Write-Host "✓ Created HTML document: $fullOutput" -ForegroundColor Green
exit 0
