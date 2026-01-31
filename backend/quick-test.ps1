# Quick health check
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
    Write-Host "Server HEALTHY" -ForegroundColor Green
    Write-Host "Database: $($health.database)"
} catch {
    Write-Host "Server DOWN" -ForegroundColor Red
}

# Quick auth test
try {
    $body = @{email="ap@demo.com"; password="1234demo"} | ConvertTo-Json
    $sa = Invoke-RestMethod -Uri "http://localhost:3000/sa/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
    $headers = @{Authorization = "Bearer $($sa.token)"}
    Write-Host "Auth OK" -ForegroundColor Green

    # Test subscriptions
    Write-Host "Testing /sa/billing/subscriptions..."
    try {
        $subs = Invoke-RestMethod -Uri "http://localhost:3000/sa/billing/subscriptions" -Headers $headers -TimeoutSec 30
        Write-Host "Subscriptions: OK (Total: $($subs.total))" -ForegroundColor Green
    } catch {
        Write-Host "Subscriptions FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Test trials
    Write-Host "Testing /sa/trials..."
    try {
        $trials = Invoke-RestMethod -Uri "http://localhost:3000/sa/trials" -Headers $headers -TimeoutSec 30
        Write-Host "Trials: OK (Count: $($trials.trials.Count))" -ForegroundColor Green
    } catch {
        Write-Host "Trials FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Test sync
    Write-Host "Testing data sync..."
    try {
        $adminBody = @{email="ap@demo.com"; password="1234demo"} | ConvertTo-Json
        $admin = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $adminBody -ContentType "application/json" -TimeoutSec 10
        $adminHeaders = @{Authorization = "Bearer $($admin.token)"}
        $me = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/me" -Headers $adminHeaders -TimeoutSec 10
        Write-Host "Admin me: OK (Company: $($me.fm_company_name))" -ForegroundColor Green

        if ($me.fm_company_id) {
            $saCompany = Invoke-RestMethod -Uri "http://localhost:3000/sa/companies/$($me.fm_company_id)" -Headers $headers -TimeoutSec 10
            Write-Host "SA Company: OK (Name: $($saCompany.name))" -ForegroundColor Green
            if ($me.fm_company_name -eq $saCompany.name) {
                Write-Host "DATA SYNC: VERIFIED" -ForegroundColor Green
            } else {
                Write-Host "DATA SYNC: MISMATCH (Admin=$($me.fm_company_name), SA=$($saCompany.name))" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "Sync FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }

} catch {
    Write-Host "Auth FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
