$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolsDir = Join-Path $repoRoot 'tools\tailwind'
$exePath = Join-Path $toolsDir 'tailwindcss-windows-x64.exe'
$url = 'https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-windows-x64.exe'

if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir | Out-Null
}

if (-not (Test-Path $exePath)) {
    Write-Host "Downloading Tailwind standalone CLI..."
    curl.exe -L $url -o $exePath
}

Push-Location $repoRoot
try {
    & $exePath -c tailwind.config.js -i php/assets/app.tailwind.css -o php/public/app.css --minify
}
finally {
    Pop-Location
}
