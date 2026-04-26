# Run all PrepNest tests (frontend + backend + E2E) in one go.
# Usage:
#   .\run-tests.ps1            # unit + integration (fast)
#   .\run-tests.ps1 -E2E       # also run Playwright E2E suite
param(
    [switch]$E2E
)

# Don't auto-fail on stderr writes (npm/Vite write deprecation warnings to
# stderr even on success). We rely on $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
$failed = $false

Write-Host ""
Write-Host "===== Frontend (Vitest) =====" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
try {
    npm test 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend tests failed (exit $LASTEXITCODE)" -ForegroundColor Red
        $failed = $true
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "===== Backend (pytest) =====" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
try {
    python -m pytest tests/ -q 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend tests failed (exit $LASTEXITCODE)" -ForegroundColor Red
        $failed = $true
    }
} finally {
    Pop-Location
}

Write-Host ""
if ($E2E) {
    Write-Host "===== Frontend E2E (Playwright) =====" -ForegroundColor Cyan
    Push-Location (Join-Path $root "frontend")
    try {
        npx playwright test 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Host "E2E tests failed (exit $LASTEXITCODE)" -ForegroundColor Red
            $failed = $true
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
if ($failed) {
    Write-Host "Some tests failed." -ForegroundColor Red
    exit 1
} else {
    Write-Host "All tests passed." -ForegroundColor Green
    exit 0
}
