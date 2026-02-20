# Model Test Script
# Test if specified models are available
#
# Common Error: "invalid claude code request"
# This error typically means:
# 1. The server received the request but expects a different format
# 2. The endpoint path might be incorrect (try /v1/chat/completions for OpenAI format)
# 3. The model name format might need adjustment (e.g., add "claude-" prefix)
# 4. AnyRouter might expect OpenAI-compatible format instead of Anthropic format

# Configuration
$baseUrl = "https://anyrouter.top"
$apiKey = "sk-r0xcxrYJYNxqoRGJ11X6ALKGVrPaZsx6Ru3RqsL0ocufgbid"
$anthropicVersion = "2023-06-01"

# Models to test
$models = @(
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-3-7-sonnet-20250219",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-1-20250805",
    "claude-opus-4-20250514",
    "claude-opus-4-5-20251101",
    "claude-opus-4-6",
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-6",
    "gpt-5-codex"
)

# Test results storage
$results = @()

# Test function
function Test-Model {
    param(
        [string]$ModelName
    )
    
    Write-Host "`nTesting model: $ModelName" -ForegroundColor Cyan
    
    try {
        # Build request URL
        $url = "$baseUrl/v1/messages"
        
        # Build request headers
        $headers = @{
            "Authorization" = "Bearer $apiKey"
            "anthropic-version" = $anthropicVersion
            "Content-Type" = "application/json"
        }
        
        # Build request body
        $body = @{
            model = $ModelName
            messages = @(
                @{
                    role = "user"
                    content = "Hello, please respond with 'OK' to confirm you are working."
                }
            )
            max_tokens = 100
        } | ConvertTo-Json -Depth 10
        
        # Debug: Show request details (optional, can be enabled for debugging)
        # Write-Host "  Request URL: $url" -ForegroundColor DarkGray
        # Write-Host "  Request Body: $body" -ForegroundColor DarkGray
        
        # Send request using Invoke-WebRequest for better error response handling
        $webResponse = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop
        # Success - parse JSON response
        $response = $webResponse.Content | ConvertFrom-Json
        
        # Check response
        if ($response) {
            $status = "Success"
            $message = "Model is available"
            
            # Parse response content
            $responseText = ""
            if ($response.content) {
                if ($response.content -is [Array]) {
                    # Handle content array
                    foreach ($item in $response.content) {
                        if ($item.type -eq "text" -and $item.text) {
                            $responseText = $item.text
                            break
                        }
                    }
                } elseif ($response.content -is [String]) {
                    $responseText = $response.content
                } else {
                    $responseText = ($response.content | ConvertTo-Json -Compress)
                }
            }
            
            if ($responseText) {
                $message += " - Response: $responseText"
            }
            
            Write-Host "  [OK] $status" -ForegroundColor Green
            Write-Host "  $message" -ForegroundColor Gray
            
            return @{
                Model = $ModelName
                Status = "Success"
                Message = $message
                Response = $responseText
                Error = $null
            }
        } else {
            $status = "Failed"
            $message = "No response"
            Write-Host "  [FAIL] $status" -ForegroundColor Red
            Write-Host "  $message" -ForegroundColor Gray
            
            return @{
                Model = $ModelName
                Status = "Failed"
                Message = $message
                Error = "No response"
            }
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
        $statusCode = $null
        $errorBody = $null
        $parsedError = $null
        $responseReceived = $false
        
        # Try to get HTTP error response
        if ($_.Exception.Response) {
            $responseReceived = $true
            $statusCode = $_.Exception.Response.StatusCode.value__
            $statusDescription = $_.Exception.Response.StatusDescription
            
            try {
                # Ensure stream is readable
                $errorStream = $_.Exception.Response.GetResponseStream()
                if ($errorStream) {
                    # Reset stream position if possible
                    if ($errorStream.CanSeek) {
                        $errorStream.Position = 0
                    }
                    
                    $reader = New-Object System.IO.StreamReader($errorStream, [System.Text.Encoding]::UTF8)
                    $errorBody = $reader.ReadToEnd()
                    $reader.Close()
                    $errorStream.Close()
                    
                    # Try to parse JSON error response
                    if ($errorBody -and $errorBody.Trim()) {
                        try {
                            $parsedError = $errorBody | ConvertFrom-Json
                        }
                        catch {
                            # Not JSON, use raw text
                        }
                    }
                }
            }
            catch {
                # Failed to read error stream - log the error
                $streamError = $_.Exception.Message
                Write-Host "  Warning: Failed to read error stream: $streamError" -ForegroundColor DarkYellow
            }
        }
        else {
            # No HTTP response - might be network error or connection issue
            $responseReceived = $false
        }
        
        # Build detailed error message
        $fullErrorMessage = $errorMessage
        
        if ($statusCode) {
            $fullErrorMessage = "HTTP $statusCode"
            if ($statusDescription) {
                $fullErrorMessage += " : $statusDescription"
            }
        }
        
        # Add parsed error details if available
        if ($parsedError) {
            $errorDetails = @()
            
            if ($parsedError.error) {
                if ($parsedError.error.message) {
                    $errorDetails += "Message: $($parsedError.error.message)"
                }
                if ($parsedError.error.type) {
                    $errorDetails += "Type: $($parsedError.error.type)"
                }
                if ($parsedError.error.param) {
                    $errorDetails += "Param: $($parsedError.error.param)"
                }
            }
            elseif ($parsedError.message) {
                $errorDetails += "Message: $($parsedError.message)"
            }
            
            if ($errorDetails.Count -gt 0) {
                $fullErrorMessage += "`n    " + ($errorDetails -join "`n    ")
            }
            
            # Also include full JSON if available
            if ($errorBody) {
                $fullErrorMessage += "`n    Full response: $errorBody"
            }
        }
        elseif ($errorBody) {
            $fullErrorMessage += "`n    Response body: $errorBody"
        }
        
        # Print error information
        Write-Host "  [FAIL] Request failed" -ForegroundColor Red
        
        # Indicate if request reached the server
        if ($responseReceived) {
            Write-Host "  Server Response: Yes (request reached server)" -ForegroundColor Cyan
            
            # Show request details for debugging "invalid claude code request" errors
            if ($statusCode -eq 400 -or $statusCode -eq 500) {
                Write-Host "  Request sent to: $url" -ForegroundColor DarkGray
                Write-Host "  Model name: $ModelName" -ForegroundColor DarkGray
                Write-Host "  Note: If you see 'invalid claude code request', the server may expect:" -ForegroundColor DarkGray
                Write-Host "    - Different endpoint path" -ForegroundColor DarkGray
                Write-Host "    - Different request format (OpenAI format instead of Anthropic)" -ForegroundColor DarkGray
                Write-Host "    - Model name with prefix (e.g., 'claude-' or 'anthropic/claude-')" -ForegroundColor DarkGray
            }
        }
        else {
            Write-Host "  Server Response: No (request may not have reached server)" -ForegroundColor Red
        }
        
        if ($statusCode) {
            Write-Host "  Status Code: $statusCode" -ForegroundColor Yellow
            if ($statusDescription) {
                Write-Host "  Status Description: $statusDescription" -ForegroundColor Yellow
            }
        }
        Write-Host "  Exception: $errorMessage" -ForegroundColor Yellow
        
        # Always try to show response body
        if ($errorBody -and $errorBody.Trim()) {
            Write-Host "  Response Body:" -ForegroundColor Yellow
            # Truncate if too long
            if ($errorBody.Length -gt 500) {
                Write-Host "    $($errorBody.Substring(0, 500))..." -ForegroundColor DarkYellow
                Write-Host "    (truncated, full body saved in results)" -ForegroundColor DarkGray
            }
            else {
                Write-Host "    $errorBody" -ForegroundColor DarkYellow
            }
        }
        elseif ($responseReceived) {
            Write-Host "  Response Body: (empty or could not be read)" -ForegroundColor DarkYellow
        }
        
        if ($parsedError) {
            Write-Host "  Parsed Error Details:" -ForegroundColor Yellow
            if ($parsedError.error) {
                if ($parsedError.error.message) {
                    Write-Host "    Message: $($parsedError.error.message)" -ForegroundColor Yellow
                }
                if ($parsedError.error.type) {
                    Write-Host "    Type: $($parsedError.error.type)" -ForegroundColor Yellow
                }
                if ($parsedError.error.param) {
                    Write-Host "    Param: $($parsedError.error.param)" -ForegroundColor Yellow
                }
            }
            elseif ($parsedError.message) {
                Write-Host "    Message: $($parsedError.message)" -ForegroundColor Yellow
            }
        }
        
        return @{
            Model = $ModelName
            Status = "Failed"
            Message = "Request failed"
            Error = $fullErrorMessage
            StatusCode = $statusCode
            ErrorBody = $errorBody
            ParsedError = $parsedError
            ResponseReceived = $responseReceived
        }
    }
}

# Main test flow
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Model Availability Test" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Test URL: $baseUrl" -ForegroundColor Gray
Write-Host "Number of models: $($models.Count)" -ForegroundColor Gray
Write-Host "Start time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# Test each model
foreach ($model in $models) {
    $result = Test-Model -ModelName $model
    $results += $result
    
    # Add delay to avoid too many requests
    Start-Sleep -Milliseconds 500
}

# Output test summary
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "Test Summary" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

$successCount = ($results | Where-Object { $_.Status -eq "Success" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "Failed" }).Count

Write-Host "Total tests: $($results.Count)" -ForegroundColor Gray
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host "End time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# Output detailed results
Write-Host "`nDetailed results:" -ForegroundColor Magenta
Write-Host "----------------------------------------" -ForegroundColor Gray

foreach ($result in $results) {
    $color = if ($result.Status -eq "Success") { "Green" } else { "Red" }
    Write-Host "$($result.Model): $($result.Status)" -ForegroundColor $color
    if ($result.Error) {
        Write-Host "  Error details:" -ForegroundColor Yellow
        # Split error message by newlines and print each line
        $errorLines = $result.Error -split "`n"
        foreach ($line in $errorLines) {
            Write-Host "    $line" -ForegroundColor Yellow
        }
    }
    if ($result.StatusCode) {
        Write-Host "  HTTP Status: $($result.StatusCode)" -ForegroundColor Yellow
    }
}

# Save results to file
$outputDir = Join-Path $PSScriptRoot "test-results"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputFile = Join-Path $outputDir "model-test-results-$timestamp.json"

$results | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "`nResults saved to: $outputFile" -ForegroundColor Cyan

# Return summary
$summary = @{
    Total = $results.Count
    Success = $successCount
    Failed = $failCount
    Results = $results
}

return $summary
