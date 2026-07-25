# הפעלת שער סיסמה — ספין זוגי
# הרצה:  cd F:\GAMED
#         .\scripts\setup-gate.ps1
#
# דרוש: חשבון Cloudflare (חינם) + GitHub CLI (gh) מחובר

$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot\.."

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   הפעלת שער כניסה — Couple Spin         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  נתיב פרויקט: $Root" -ForegroundColor Green
Write-Host ""

# ── בדיקות ──
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "  ✗ GitHub CLI (gh) לא מותקן." -ForegroundColor Red
  Write-Host "    התקנה: winget install GitHub.cli" -ForegroundColor Yellow
  exit 1
}

$ghUser = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ✗ לא מחובר ל-GitHub. הרץ: gh auth login" -ForegroundColor Red
  exit 1
}

Write-Host "  ✓ GitHub CLI מחובר" -ForegroundColor Green

$vars = gh variable list 2>$null
$hasAuthUrl = $vars -match "VITE_AUTH_API_URL"
$secrets = gh secret list 2>$null
$hasPass = $secrets -match "PASS_W"
$hasCfToken = $secrets -match "CLOUDFLARE_API_TOKEN"
$hasCfAccount = $secrets -match "CLOUDFLARE_ACCOUNT_ID"

Write-Host ""
Write-Host "  מצב נוכחי:" -ForegroundColor White
Write-Host "    PASS_W secret              $(if ($hasPass) {'✓'} else {'✗ חסר'})"
Write-Host "    CLOUDFLARE_API_TOKEN       $(if ($hasCfToken) {'✓'} else {'✗ חסר'})"
Write-Host "    CLOUDFLARE_ACCOUNT_ID      $(if ($hasCfAccount) {'✓'} else {'✗ חסר'})"
Write-Host "    VITE_AUTH_API_URL variable $(if ($hasAuthUrl) {'✓'} else {'✗ חסר'})"
Write-Host ""

if ($hasPass -and $hasCfToken -and $hasCfAccount -and $hasAuthUrl) {
  Write-Host "  הכל מוגדר! מפעיל deploy Worker + אתר..." -ForegroundColor Green
  gh workflow run deploy-auth.yml
  Start-Sleep -Seconds 2
  gh workflow run deploy.yml
  Write-Host ""
  Write-Host "  ✓ Workflows הופעלו. עקוב: gh run list" -ForegroundColor Green
  Write-Host "  אתר: https://elia448811-coder.github.io/double-game/" -ForegroundColor Cyan
  exit 0
}

Write-Host "  ── הגדרה (פעם אחת) ──" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1) Cloudflare → My Profile → API Tokens → Create Token"
Write-Host "     תבנית: Edit Cloudflare Workers"
Write-Host "  2) Account ID: dash.cloudflare.com → Workers → מימין"
Write-Host ""

$cfToken = Read-Host "  Cloudflare API Token"
$cfAccount = Read-Host "  Cloudflare Account ID"
$passW = Read-Host "  סיסמת כניסה לאתר (PASS_W)" -AsSecureString
$passPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passW)
)

if (-not $cfToken -or -not $cfAccount -or -not $passPlain) {
  Write-Host "  ✗ כל השדות חובה." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  שומר Secrets ב-GitHub..." -ForegroundColor White
$passPlain | gh secret set PASS_W
$cfToken | gh secret set CLOUDFLARE_API_TOKEN
$cfAccount | gh secret set CLOUDFLARE_ACCOUNT_ID

Write-Host "  מפרס Worker..." -ForegroundColor White
Push-Location "$Root\worker"
$env:CLOUDFLARE_API_TOKEN = $cfToken
$env:CLOUDFLARE_ACCOUNT_ID = $cfAccount
echo $passPlain | npx wrangler secret put PASS_W 2>&1 | Out-Host
$deployOut = npx wrangler deploy 2>&1 | Out-String
Pop-Location
Write-Host $deployOut

$workerUrl = ""
if ($deployOut -match "(https://couple-spin-auth[^\s]+\.workers\.dev)") {
  $workerUrl = $Matches[1]
} else {
  $workerUrl = Read-Host "  הדבק כתובת Worker (https://couple-spin-auth....workers.dev)"
}

$workerUrl = $workerUrl.TrimEnd('/')
Write-Host "  מגדיר VITE_AUTH_API_URL = $workerUrl" -ForegroundColor White
gh variable set VITE_AUTH_API_URL --body $workerUrl

Write-Host ""
Write-Host "  מפעיל build + deploy לאתר..." -ForegroundColor White
gh workflow run deploy.yml

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║  שער הכניסה הופעל!                       ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  אתר:    https://elia448811-coder.github.io/double-game/"
Write-Host "  Worker: $workerUrl"
Write-Host "  סיסמה:  (מה שהזנת)"
Write-Host ""
Write-Host "  בדיקה:  node scripts/test-auth.mjs" -ForegroundColor Gray
Write-Host "          `$env:AUTH_TEST_URL='$workerUrl'; node scripts/test-auth.mjs"
Write-Host ""

# ניקוי סיסמה מהזיכרון
$passPlain = $null
