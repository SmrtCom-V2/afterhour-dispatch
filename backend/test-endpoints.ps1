# Quick endpoint test
$ErrorActionPreference = "Continue"

# Login first
$loginBody = @{email="ap@demo.com"; password="1234demo"} | ConvertTo-Json
$sa = Invoke-RestMethod -Uri "http://localhost:3000/sa/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$saHeaders = @{Authorization = "Bearer $($sa.token)"}

Write-Host "Testing Subscriptions endpoint..."
try {
    $subs = Invoke-RestMethod -Uri "http://localhost:3000/sa/billing/subscriptions" -Headers $saHeaders -TimeoutSec 30
    Write-Host "Subscriptions: SUCCESS" -ForegroundColor Green
    Write-Host "Total: $($subs.total)"
    foreach ($sub in $subs.subscriptions | Select-Object -First 3) {
        Write-Host "  -> $($sub.name)"
    }
} catch {
    Write-Host "Subscriptions: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Testing Trials endpoint..."
try {
    $trials = Invoke-RestMethod -Uri "http://localhost:3000/sa/trials" -Headers $saHeaders -TimeoutSec 30
    Write-Host "Trials: SUCCESS" -ForegroundColor Green
    if ($trials.trials) {
        Write-Host "Count: $($trials.trials.Count)"
        foreach ($trial in $trials.trials | Select-Object -First 3) {
            Write-Host "  -> $($trial.name) | Ends: $($trial.trial_end_at)"
        }
    } else {
        Write-Host "Count: $($trials.Count)"
    }
} catch {
    Write-Host "Trials: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Testing Data Sync..."
# Admin login
$adminBody = @{email="ap@demo.com"; password="1234demo"} | ConvertTo-Json
$admin = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $adminBody -ContentType "application/json"
$adminHeaders = @{Authorization = "Bearer $($admin.token)"}

try {
    $me = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/me" -Headers $adminHeaders
    Write-Host "Admin /me: SUCCESS" -ForegroundColor Green
    Write-Host "Company ID: $($me.fm_company_id)"
    Write-Host "Company Name: $($me.fm_company_name)"

    if ($me.fm_company_id) {
        $saCompany = Invoke-RestMethod -Uri "http://localhost:3000/sa/companies/$($me.fm_company_id)" -Headers $saHeaders
        Write-Host "SA Company: SUCCESS" -ForegroundColor Green
        Write-Host "SA Company Name: $($saCompany.name)"

        if ($me.fm_company_name -eq $saCompany.name) {
            Write-Host "DATA SYNC: VERIFIED" -ForegroundColor Green
        } else {
            Write-Host "DATA SYNC: MISMATCH" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "Data Sync: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}
