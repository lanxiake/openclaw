# Create Print Document from Images and Text
# Usage: .\create_print_doc.ps1 -Output "output.docx" [-Title "Title"] [-Images @("img1.jpg")] [-Texts @("text1")]

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

# Check if Word is available
try {
    $word = New-Object -ComObject Word.Application -ErrorAction Stop
} catch {
    Write-Error "Microsoft Word is not available: $_"
    exit 1
}

$word.Visible = $false

try {
    # Create new document
    $doc = $word.Documents.Add()
    $selection = $word.Selection
    
    # Add title if provided
    if ($Title) {
        $selection.Style = "Heading 1"
        $selection.ParagraphFormat.Alignment = 1  # Center
        $selection.TypeText($Title)
        $selection.TypeParagraph()
        $selection.TypeParagraph()
        $selection.Style = "Normal"
    }
    
    # Add images
    foreach ($imgPath in $Images) {
        try {
            $fullPath = Resolve-Path $imgPath -ErrorAction Stop
            
            # Insert image
            $shape = $selection.InlineShapes.AddPicture($fullPath.Path)
            
            # Scale to fit page (6 inches width max = 432 points)
            $maxWidth = 432
            if ($shape.Width -gt $maxWidth) {
                $ratio = $maxWidth / $shape.Width
                $shape.Width = $maxWidth
                $shape.Height = $shape.Height * $ratio
            }
            
            # Center image
            $selection.ParagraphFormat.Alignment = 1
            $selection.TypeParagraph()
            $selection.TypeParagraph()
        } catch {
            Write-Warning "Failed to add image $imgPath : $_"
        }
    }
    
    # Add texts
    foreach ($text in $Texts) {
        $selection.ParagraphFormat.Alignment = 0  # Left
        $selection.TypeText($text)
        $selection.TypeParagraph()
        $selection.TypeParagraph()
    }
    
    # Save document
    $fullOutput = Join-Path (Get-Location) $Output
    $doc.SaveAs([ref]$fullOutput, [ref]16)  # 16 = wdFormatDocumentDefault (.docx)
    $doc.Close()
    
    Write-Host "✓ Created document: $fullOutput" -ForegroundColor Green
    exit 0
    
} catch {
    Write-Error "Failed to create document: $_"
    if ($doc) { $doc.Close([ref]$false) }
    exit 1
} finally {
    if ($word) {
        $word.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}
