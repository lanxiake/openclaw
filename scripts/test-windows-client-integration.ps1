# Windows Client Integration Test Script
# Purpose: Test Windows client integration with OpenClaw Gateway

param(
    [string]$GatewayUrl = "ws://127.0.0.1:18789",
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false
)

Write-Host "=== Windows Client Integration Test ===" -ForegroundColor Cyan
Write-Host "Gateway URL: $GatewayUrl" -ForegroundColor Gray
Write-Host ""

$testResults = @()
$totalTests = 0
$passedTests = 0
$failedTests = 0

function Record-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )

    $script:totalTests++
    if ($Passed) {
        $script:passedTests++
        $status = "PASS"
        $color = "Green"
    } else {
        $script:failedTests++
        $status = "FAIL"
        $color = "Red"
    }

    $script:testResults += [PSCustomObject]@{
        Test = $TestName
        Status = $status
        Details = $Message
    }

    Write-Host "  [$status] $TestName" -ForegroundColor $color
    if ($Message -and $Verbose) {
        Write-Host "    $Message" -ForegroundColor Gray
    }
}

# Test 1: Gateway Health Check
Write-Host "`n[Test 1/6] Gateway Health Check" -ForegroundColor Yellow

try {
    $healthOutput = pnpm openclaw gateway health --json 2>&1 | Out-String
    $health = $healthOutput | ConvertFrom-Json

    if ($health.ok) {
        Record-TestResult -TestName "Gateway Health" -Passed $true -Message "Response time: $($health.durationMs) ms"
    } else {
        Record-TestResult -TestName "Gateway Health" -Passed $false -Message "Health check returned ok=false"
    }
} catch {
    Record-TestResult -TestName "Gateway Health" -Passed $false -Message "Exception: $_"
}

# Test 2: Gateway Status Query
Write-Host "`n[Test 2/6] Gateway Status Query" -ForegroundColor Yellow

try {
    $statusOutput = pnpm openclaw gateway status --json 2>&1 | Out-String
    $status = $statusOutput | ConvertFrom-Json

    if ($status.rpc.ok) {
        Record-TestResult -TestName "Gateway RPC Connection" -Passed $true -Message "URL: $($status.rpc.url)"
    } else {
        Record-TestResult -TestName "Gateway RPC Connection" -Passed $false -Message "Error: $($status.rpc.error)"
    }

    if ($status.port.status -eq "listening") {
        Record-TestResult -TestName "Gateway Port Listening" -Passed $true -Message "Port: $($status.port.port)"
    } else {
        Record-TestResult -TestName "Gateway Port Listening" -Passed $false -Message "Status: $($status.port.status)"
    }
} catch {
    Record-TestResult -TestName "Gateway Status Query" -Passed $false -Message "Exception: $_"
}

# Test 3: Gateway Discovery
Write-Host "`n[Test 3/6] Gateway Discovery" -ForegroundColor Yellow

try {
    $discoverOutput = pnpm openclaw gateway discover --json --timeout 3000 2>&1 | Out-String
    $discover = $discoverOutput | ConvertFrom-Json

    if ($discover.count -gt 0) {
        Record-TestResult -TestName "Gateway Discovery" -Passed $true -Message "Found $($discover.count) gateway(s)"
    } else {
        Record-TestResult -TestName "Gateway Discovery" -Passed $false -Message "No gateways found"
    }
} catch {
    Record-TestResult -TestName "Gateway Discovery" -Passed $false -Message "Exception: $_"
}

# Test 4: CLI Commands
Write-Host "`n[Test 4/6] CLI Commands Test" -ForegroundColor Yellow

$cliCommands = @(
    @{Name="gateway call health"; Command="openclaw gateway call health --json"},
    @{Name="gateway usage-cost"; Command="openclaw gateway usage-cost --days 1 --json"}
)

foreach ($cmd in $cliCommands) {
    try {
        $output = Invoke-Expression "pnpm $($cmd.Command)" 2>&1 | Out-String
        $result = $output | ConvertFrom-Json

        if ($result) {
            Record-TestResult -TestName "CLI: $($cmd.Name)" -Passed $true
        } else {
            Record-TestResult -TestName "CLI: $($cmd.Name)" -Passed $false -Message "Empty result"
        }
    } catch {
        Record-TestResult -TestName "CLI: $($cmd.Name)" -Passed $false -Message "Exception: $_"
    }
}

# Test 5: Windows Client Build Check
Write-Host "`n[Test 5/6] Windows Client Build Check" -ForegroundColor Yellow

if ($SkipBuild) {
    Write-Host "Skipping build test" -ForegroundColor Gray
    Record-TestResult -TestName "Client Build" -Passed $true -Message "Skipped"
} else {
    if (Test-Path "apps/windows") {
        Record-TestResult -TestName "Client Directory Exists" -Passed $true

        if (Test-Path "apps/windows/package.json") {
            Record-TestResult -TestName "Client Config File" -Passed $true

            if (Test-Path "apps/windows/node_modules") {
                Record-TestResult -TestName "Client Dependencies" -Passed $true
            } else {
                Record-TestResult -TestName "Client Dependencies" -Passed $false -Message "Run: cd apps/windows && pnpm install"
            }
        } else {
            Record-TestResult -TestName "Client Config File" -Passed $false
        }
    } else {
        Record-TestResult -TestName "Client Directory Exists" -Passed $false
    }
}

# Test 6: WebSocket Connection
Write-Host "`n[Test 6/6] WebSocket Connection Test" -ForegroundColor Yellow

$wsTestScript = @"
const WebSocket = require('ws');
const ws = new WebSocket('$GatewayUrl');
let connected = false;

ws.on('open', () => {
    connected = true;
    console.log('CONNECTED');
    ws.close();
});

ws.on('error', (error) => {
    console.error('ERROR:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    if (connected) {
        console.log('CLOSED');
        process.exit(0);
    } else {
        console.error('FAILED');
        process.exit(1);
    }
});

setTimeout(() => {
    if (!connected) {
        console.error('TIMEOUT');
        ws.close();
        process.exit(1);
    }
}, 5000);
"@

$wsTestFile = "$env:TEMP\openclaw-ws-test.js"
$wsTestScript | Out-File -FilePath $wsTestFile -Encoding UTF8

try {
    $wsOutput = node $wsTestFile 2>&1 | Out-String
    if ($wsOutput -match "CONNECTED") {
        Record-TestResult -TestName "WebSocket Connection" -Passed $true -Message "Connection successful"
    } else {
        Record-TestResult -TestName "WebSocket Connection" -Passed $false -Message "Connection failed: $wsOutput"
    }
} catch {
    Record-TestResult -TestName "WebSocket Connection" -Passed $false -Message "Exception: $_"
} finally {
    if (Test-Path $wsTestFile) {
        Remove-Item $wsTestFile -Force
    }
}

# Output Test Results
Write-Host "`n=== Test Results Summary ===" -ForegroundColor Cyan
Write-Host ""

$testResults | Format-Table -AutoSize

Write-Host "Test Statistics:" -ForegroundColor Cyan
Write-Host "  Total Tests: $totalTests" -ForegroundColor Gray
Write-Host "  Passed: $passedTests" -ForegroundColor Green
Write-Host "  Failed: $failedTests" -ForegroundColor Red
Write-Host "  Pass Rate: $([math]::Round($passedTests / $totalTests * 100, 2))%" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

# Generate Test Report
$reportPath = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$report = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    gatewayUrl = $GatewayUrl
    totalTests = $totalTests
    passedTests = $passedTests
    failedTests = $failedTests
    passRate = [math]::Round($passedTests / $totalTests * 100, 2)
    results = $testResults
} | ConvertTo-Json -Depth 10

$report | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "Test report saved: $reportPath" -ForegroundColor Gray
Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "=== All Tests Passed ===" -ForegroundColor Green
    exit 0
} else {
    Write-Host "=== Some Tests Failed ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check gateway status: pnpm openclaw gateway status" -ForegroundColor Gray
    Write-Host "  2. View gateway logs: Get-Content logs/gateway.log -Tail 50" -ForegroundColor Gray
    Write-Host "  3. Restart gateway: .\scripts\start-gateway-test.ps1 -Clean" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
