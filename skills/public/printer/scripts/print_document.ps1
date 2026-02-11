# Print Document Script (Updated)
# Usage: .\print_document.ps1 -FilePath "path\to\file" [-Printer "PrinterName"]

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [string]$Printer = $null
)

# Resolve full path
$FilePath = Resolve-Path $FilePath -ErrorAction Stop

# Get printer
if ($Printer) {
    $printerObj = Get-Printer -Name $Printer -ErrorAction Stop
    $PrinterName = $printerObj.Name
} else {
    $printerObj = Get-Printer | Where-Object {$_.Default -eq $true} | Select-Object -First 1
    if ($printerObj) {
        $PrinterName = $printerObj.Name
    } else {
        $PrinterName = "Microsoft Print to PDF"
    }
}

Write-Host "Printing: $FilePath"
Write-Host "Printer: $PrinterName"

# Use rundll32 to print (Windows built-in print handler)
try {
    $process = Start-Process -FilePath "rundll32.exe" -ArgumentList "shimgvw.dll,ImageView_PrintTo `"$FilePath`" `"$PrinterName`"" -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "✓ Sent to printer successfully" -ForegroundColor Green
        exit 0
    } else {
        Write-Error "Print command returned error code: $($process.ExitCode)"
        exit 1
    }
} catch {
    Write-Error "Failed to print: $_"
    exit 1
}
