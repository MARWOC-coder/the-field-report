# The Field Report — one-command deploy to GitHub Pages.
# First run creates the repo and enables Pages; later runs just ship updates.
# Requires: gh CLI logged in (it is), node/npm.
param([ValidateSet('public','private')][string]$Visibility = 'public')

$ErrorActionPreference = 'Stop'
$repo = 'MARWOC-coder/the-field-report'
$root = Split-Path $PSScriptRoot -Parent

# 1. Create the GitHub repo if it doesn't exist yet
gh repo view $repo 2>$null | Out-Null
if (-not $?) {
  Write-Host "Creating $repo ($Visibility)..."
  gh repo create $repo "--$Visibility" --description "Gamified daily KPI tracker for the MARWOC community"
}

# 2. Push source
Set-Location $root
$hasOrigin = git remote | Select-String -Quiet '^origin$'
if (-not $hasOrigin) { git remote add origin "https://github.com/$repo.git" }
git push -u origin main

# 3. Build and publish app/dist to the gh-pages branch
Set-Location "$root\app"
npm run build
Set-Location "$root\app\dist"
if (Test-Path .git) { Remove-Item -Recurse -Force .git }
New-Item -ItemType File -Force .nojekyll | Out-Null
git init -b gh-pages | Out-Null
git add -A
git commit -q -m "deploy"
git push -f "https://github.com/$repo.git" gh-pages
Remove-Item -Recurse -Force .git
Set-Location $root

# 4. Enable GitHub Pages from the gh-pages branch (idempotent)
try {
  gh api "repos/$repo/pages" -X POST -f "source[branch]=gh-pages" -f "source[path]=/" 2>$null | Out-Null
} catch {}

Write-Host ""
Write-Host "Deployed. Live in ~1 minute at:"
Write-Host "  https://marwoc-coder.github.io/the-field-report/"
Write-Host "(Note: GitHub Pages on a private repo requires a paid GitHub plan; use -Visibility public otherwise.)"
