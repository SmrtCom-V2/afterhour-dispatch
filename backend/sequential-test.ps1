# Sequential test with delays
$ErrorActionPreference = "Continue"

Write-Host "Step 1: Health check..."
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 10
    Write-Host "  PASS: Server healthy, DB connected" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 1

Write-Host "Step 2: Super Admin login..."
try {
    $body = @{email="ap@demo.com"; password="1234demo"} | ConvertTo-Json
    $sa = Invoke-RestMethod -Uri "http://localhost:3000/sa/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15
    $token = $sa.token
    $headers = @{Authorization = "Bearer $token"}
    Write-Host "  PASS: Token received" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 1

Write-Host "Step 3: Dashboard..."
try {
    $dash = Invoke-RestMethod -Uri "http://localhost:3000/sa/dashboard" -Headers $headers -TimeoutSec 15
    Write-Host "  PASS: Total companies = $($dash.kpis.total_companies)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

Write-Host "Step 4: Companies..."
try {
    $companies = Invoke-RestMethod -Uri "http://localhost:3000/sa/companies" -Headers $headers -TimeoutSec 15
    Write-Host "  PASS: Companies retrieved" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

Write-Host "Step 5: Billing overview..."
try {
    $billing = Invoke-RestMethod -Uri "http://localhost:3000/sa/billing/overview" -Headers $headers -TimeoutSec 15
    Write-Host "  PASS: MRR = EUR $($billing.stats.current_mrr)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

Write-Host "Step 6: Billing subscriptions..."
try {
    $subs = Invoke-RestMethod -Uri "http://localhost:3000/sa/billing/subscriptions" -Headers $headers -TimeoutSec 15
    Write-Host "  PASS: Total = $($subs.total)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

Write-Host "Step 7: Trials..."
try {
    $trials = Invoke-RestMethod -Uri "http://localhost:3000/sa/trials" -Headers $headers -TimeoutSec 15
    Write-Host "  PASS: Trials count = $($trials.trials.Count)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Sequential test complete!" -ForegroundColor Cyan
