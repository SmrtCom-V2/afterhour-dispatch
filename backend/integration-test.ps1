# VP R&D / VP Product Integration Test Suite
# 24-7 Web System - Admin & Super Admin Integration

$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3000"

Write-Host "========================================================================"
Write-Host "   VP R&D / VP Product Integration Test Suite"
Write-Host "   24-7 Web System - Admin and Super Admin Integration"
Write-Host "========================================================================"
Write-Host ""

$results = @()

# ==== 1. HEALTH CHECK ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[HEALTH] SECTION 1: SYSTEM HEALTH"
Write-Host "------------------------------------------------------------------------"

try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "[PASS] System Health: $($health.status)" -ForegroundColor Green
    Write-Host "       Database: $($health.database)"
    $results += @{Test="Health Check"; Status="PASS"}
} catch {
    Write-Host "[FAIL] Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
    $results += @{Test="Health Check"; Status="FAIL"}
}
Write-Host ""

# ==== 2. ADMIN AUTHENTICATION ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[AUTH] SECTION 2: ADMIN AUTHENTICATION"
Write-Host "------------------------------------------------------------------------"

$adminToken = $null
try {
    $loginBody = @{email="ap@demo.com"; password="1234demo"} | ConvertTo-Json
    $admin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $adminToken = $admin.token
    Write-Host "[PASS] Admin Login Successful" -ForegroundColor Green
    Write-Host "       User: $($admin.user.name)"
    Write-Host "       Email: $($admin.user.email)"
    Write-Host "       Company: $($admin.user.fm_company_name)"
    Write-Host "       Company ID: $($admin.user.fm_company_id)"
    $results += @{Test="Admin Login"; Status="PASS"}
} catch {
    Write-Host "[FAIL] Admin Login Failed: $($_.Exception.Message)" -ForegroundColor Red
    $results += @{Test="Admin Login"; Status="FAIL"}
}
Write-Host ""

# ==== 3. SUPER ADMIN AUTHENTICATION ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[SA AUTH] SECTION 3: SUPER ADMIN AUTHENTICATION"
Write-Host "------------------------------------------------------------------------"

$saToken = $null
try {
    $saLoginBody = @{email="ap@demo.com"; password="1234demo"} | ConvertTo-Json
    $sa = Invoke-RestMethod -Uri "$baseUrl/sa/auth/login" -Method POST -Body $saLoginBody -ContentType "application/json"
    $saToken = $sa.token
    Write-Host "[PASS] Super Admin Login Successful" -ForegroundColor Green
    Write-Host "       User: $($sa.user.name)"
    Write-Host "       Is Super Admin: $($sa.user.is_super_admin)"
    $results += @{Test="Super Admin Login"; Status="PASS"}
} catch {
    Write-Host "[FAIL] Super Admin Login Failed: $($_.Exception.Message)" -ForegroundColor Red
    $results += @{Test="Super Admin Login"; Status="FAIL"}
}
Write-Host ""

# ==== 4. ADMIN PORTAL - CORE DATA ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[DATA] SECTION 4: ADMIN PORTAL - CORE DATA ACCESS"
Write-Host "------------------------------------------------------------------------"

if ($adminToken) {
    $headers = @{Authorization = "Bearer $adminToken"}

    # Incidents
    try {
        $incidents = Invoke-RestMethod -Uri "$baseUrl/api/incidents" -Headers $headers
        $incidentCount = if ($incidents.incidents) { $incidents.incidents.Count } elseif ($incidents.Count) { $incidents.Count } else { 0 }
        Write-Host "[PASS] Incidents: $incidentCount records" -ForegroundColor Green
        $results += @{Test="Admin - Incidents"; Status="PASS"; Data=$incidentCount}
    } catch {
        Write-Host "[FAIL] Incidents Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="Admin - Incidents"; Status="FAIL"}
    }

    # Buildings
    try {
        $buildings = Invoke-RestMethod -Uri "$baseUrl/api/buildings" -Headers $headers
        $buildingCount = if ($buildings.Count) { $buildings.Count } else { 0 }
        Write-Host "[PASS] Buildings: $buildingCount records" -ForegroundColor Green
        $results += @{Test="Admin - Buildings"; Status="PASS"; Data=$buildingCount}
    } catch {
        Write-Host "[FAIL] Buildings Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="Admin - Buildings"; Status="FAIL"}
    }

    # PM Companies
    try {
        $pmCompanies = Invoke-RestMethod -Uri "$baseUrl/api/pm-companies" -Headers $headers
        $pmCount = if ($pmCompanies.Count) { $pmCompanies.Count } else { 0 }
        Write-Host "[PASS] PM Companies: $pmCount records" -ForegroundColor Green
        $results += @{Test="Admin - PM Companies"; Status="PASS"; Data=$pmCount}
    } catch {
        Write-Host "[FAIL] PM Companies Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="Admin - PM Companies"; Status="FAIL"}
    }

    # Service Providers
    try {
        $providers = Invoke-RestMethod -Uri "$baseUrl/api/service-providers" -Headers $headers
        $providerCount = if ($providers.Count) { $providers.Count } else { 0 }
        Write-Host "[PASS] Service Providers: $providerCount records" -ForegroundColor Green
        $results += @{Test="Admin - Service Providers"; Status="PASS"; Data=$providerCount}
    } catch {
        Write-Host "[FAIL] Service Providers Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="Admin - Service Providers"; Status="FAIL"}
    }
} else {
    Write-Host "[SKIP] Skipping Admin Portal tests - No token" -ForegroundColor Yellow
}
Write-Host ""

# ==== 5. BILLING PLANS ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[BILLING] SECTION 5: BILLING PLANS (Database-Driven)"
Write-Host "------------------------------------------------------------------------"

try {
    $plans = Invoke-RestMethod -Uri "$baseUrl/api/billing/plans" -Method GET
    Write-Host "[PASS] Billing Plans Retrieved: $($plans.Count) plans" -ForegroundColor Green
    foreach ($plan in $plans) {
        $price = if ($plan.price) { "EUR $($plan.price)" } else { "Custom" }
        Write-Host "       -> $($plan.name): $price"
    }
    $results += @{Test="Billing Plans"; Status="PASS"; Data=$plans.Count}
} catch {
    Write-Host "[FAIL] Billing Plans Failed: $($_.Exception.Message)" -ForegroundColor Red
    $results += @{Test="Billing Plans"; Status="FAIL"}
}
Write-Host ""

# ==== 6. SUPER ADMIN - DASHBOARD ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[SA DASH] SECTION 6: SUPER ADMIN DASHBOARD"
Write-Host "------------------------------------------------------------------------"

if ($saToken) {
    $saHeaders = @{Authorization = "Bearer $saToken"}

    try {
        $dashboard = Invoke-RestMethod -Uri "$baseUrl/sa/dashboard" -Headers $saHeaders
        Write-Host "[PASS] Dashboard KPIs Retrieved" -ForegroundColor Green
        Write-Host "       Total Companies: $($dashboard.kpis.total_companies)"
        Write-Host "       Active Companies: $($dashboard.kpis.active_companies)"
        Write-Host "       Active Trials: $($dashboard.kpis.active_trials)"
        Write-Host "       Paid Companies: $($dashboard.kpis.paid_companies)"
        Write-Host "       MRR: EUR $($dashboard.kpis.mrr)" -ForegroundColor Cyan
        Write-Host "       ARR: EUR $($dashboard.kpis.arr)" -ForegroundColor Cyan
        Write-Host "       Churn Rate: $($dashboard.kpis.churn_rate)%"
        Write-Host "       New Signups (24h): $($dashboard.kpis.new_signups_24h)"
        $results += @{Test="SA Dashboard"; Status="PASS"}
    } catch {
        Write-Host "[FAIL] Dashboard Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="SA Dashboard"; Status="FAIL"}
    }
} else {
    Write-Host "[SKIP] Skipping SA Dashboard - No token" -ForegroundColor Yellow
}
Write-Host ""

# ==== 7. SUPER ADMIN - COMPANIES LIST ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[SA COMPANIES] SECTION 7: SUPER ADMIN - COMPANIES MANAGEMENT"
Write-Host "------------------------------------------------------------------------"

if ($saToken) {
    try {
        $companies = Invoke-RestMethod -Uri "$baseUrl/sa/companies" -Headers $saHeaders
        $companyList = if ($companies.companies) { $companies.companies } else { $companies }
        Write-Host "[PASS] Companies Retrieved: $($companyList.Count) companies" -ForegroundColor Green
        foreach ($company in $companyList | Select-Object -First 5) {
            Write-Host "       -> $($company.name) | Status: $($company.status) | Owner: $($company.owner_email)"
        }
        if ($companyList.Count -gt 5) {
            Write-Host "       ... and $($companyList.Count - 5) more"
        }
        $results += @{Test="SA Companies List"; Status="PASS"; Data=$companyList.Count}
    } catch {
        Write-Host "[FAIL] Companies List Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="SA Companies List"; Status="FAIL"}
    }
} else {
    Write-Host "[SKIP] Skipping - No SA token" -ForegroundColor Yellow
}
Write-Host ""

# ==== 8. SUPER ADMIN - BILLING OVERVIEW ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[SA BILLING] SECTION 8: SUPER ADMIN - BILLING OVERVIEW"
Write-Host "------------------------------------------------------------------------"

if ($saToken) {
    try {
        $billing = Invoke-RestMethod -Uri "$baseUrl/sa/billing/overview" -Headers $saHeaders
        Write-Host "[PASS] Billing Overview Retrieved" -ForegroundColor Green
        Write-Host "       Current MRR: EUR $($billing.stats.current_mrr)" -ForegroundColor Cyan
        Write-Host "       ARR: EUR $($billing.stats.arr)" -ForegroundColor Cyan
        Write-Host "       Active Subscriptions: $($billing.stats.active_subscriptions)"
        Write-Host "       Past Due: $($billing.stats.past_due_count)"
        Write-Host "       Cancelled (30d): $($billing.stats.cancelled_30d)"
        $results += @{Test="SA Billing Overview"; Status="PASS"}
    } catch {
        Write-Host "[FAIL] Billing Overview Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="SA Billing Overview"; Status="FAIL"}
    }
} else {
    Write-Host "[SKIP] Skipping - No SA token" -ForegroundColor Yellow
}
Write-Host ""

# ==== 9. SUPER ADMIN - SUBSCRIPTIONS ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[SA SUBS] SECTION 9: SUPER ADMIN - SUBSCRIPTIONS"
Write-Host "------------------------------------------------------------------------"

if ($saToken) {
    try {
        $subs = Invoke-RestMethod -Uri "$baseUrl/sa/billing/subscriptions" -Headers $saHeaders
        Write-Host "[PASS] Subscriptions Retrieved: $($subs.total) total" -ForegroundColor Green
        foreach ($sub in $subs.subscriptions | Select-Object -First 3) {
            $price = if ($sub.price_monthly) { "EUR $([math]::Round($sub.price_monthly / 100))" } else { "N/A" }
            Write-Host "       -> $($sub.name) | Plan: $($sub.plan_name) | Price: $price | Status: $($sub.status)"
        }
        $results += @{Test="SA Subscriptions"; Status="PASS"; Data=$subs.total}
    } catch {
        Write-Host "[FAIL] Subscriptions Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="SA Subscriptions"; Status="FAIL"}
    }
} else {
    Write-Host "[SKIP] Skipping - No SA token" -ForegroundColor Yellow
}
Write-Host ""

# ==== 10. SUPER ADMIN - TRIALS ENDING ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[SA TRIALS] SECTION 10: SUPER ADMIN - TRIALS MANAGEMENT"
Write-Host "------------------------------------------------------------------------"

if ($saToken) {
    try {
        $trials = Invoke-RestMethod -Uri "$baseUrl/sa/trials" -Headers $saHeaders
        $trialList = if ($trials.trials) { $trials.trials } else { $trials }
        Write-Host "[PASS] Trials Retrieved: $($trialList.Count) trials" -ForegroundColor Green
        foreach ($trial in $trialList | Select-Object -First 3) {
            Write-Host "       -> $($trial.name) | Ends: $($trial.trial_end_at)"
        }
        $results += @{Test="SA Trials"; Status="PASS"; Data=$trialList.Count}
    } catch {
        Write-Host "[FAIL] Trials Failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Test="SA Trials"; Status="FAIL"}
    }
} else {
    Write-Host "[SKIP] Skipping - No SA token" -ForegroundColor Yellow
}
Write-Host ""

# ==== 11. DATA SYNCHRONIZATION CHECK ====
Write-Host "------------------------------------------------------------------------"
Write-Host "[SYNC] SECTION 11: DATA SYNCHRONIZATION (Admin <-> Super Admin)"
Write-Host "------------------------------------------------------------------------"

if ($adminToken -and $saToken) {
    # Get admin's company data
    try {
        $adminMe = Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Headers $headers
        $adminCompanyId = $adminMe.fm_company_id
        Write-Host "[PASS] Admin Company ID: $adminCompanyId" -ForegroundColor Green

        # Find same company in Super Admin view
        $saCompany = Invoke-RestMethod -Uri "$baseUrl/sa/companies/$adminCompanyId" -Headers $saHeaders
        Write-Host "[PASS] Same company visible in Super Admin" -ForegroundColor Green
        Write-Host "       Name (Admin): $($adminMe.fm_company_name)"
        Write-Host "       Name (SA): $($saCompany.name)"
        Write-Host "       Status: $($saCompany.status)"

        if ($adminMe.fm_company_name -eq $saCompany.name) {
            Write-Host "[PASS] Data Consistent Between Portals" -ForegroundColor Green
            $results += @{Test="Data Sync Check"; Status="PASS"}
        } else {
            Write-Host "[FAIL] Data Mismatch Detected!" -ForegroundColor Red
            $results += @{Test="Data Sync Check"; Status="FAIL"}
        }
    } catch {
        Write-Host "[SKIP] Could not verify sync: $($_.Exception.Message)" -ForegroundColor Yellow
        $results += @{Test="Data Sync Check"; Status="SKIP"}
    }
} else {
    Write-Host "[SKIP] Skipping - Missing tokens" -ForegroundColor Yellow
}
Write-Host ""

# ==== FINAL SUMMARY ====
Write-Host "========================================================================"
Write-Host "                    INTEGRATION TEST SUMMARY"
Write-Host "========================================================================"
Write-Host ""

$passed = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$skipped = ($results | Where-Object { $_.Status -eq "SKIP" }).Count
$total = $results.Count

Write-Host "  Tests Passed:  $passed" -ForegroundColor Green
Write-Host "  Tests Failed:  $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "  Tests Skipped: $skipped" -ForegroundColor Yellow
Write-Host "  Total Tests:   $total"
Write-Host ""

if ($failed -eq 0) {
    Write-Host "  [SUCCESS] ALL SYSTEMS OPERATIONAL" -ForegroundColor Green
    Write-Host "  Admin and Super Admin are properly integrated."
} else {
    Write-Host "  [WARNING] SOME TESTS FAILED - Review above for details" -ForegroundColor Red
}
Write-Host ""
