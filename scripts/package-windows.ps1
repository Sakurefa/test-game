$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$appDirectory = Join-Path $root "release/win-unpacked"
$zipPath = Join-Path $root ("release/Market-Simulator-" + $package.version + "-Windows-x64.zip")

if (-not (Test-Path (Join-Path $appDirectory "Market Simulator.exe"))) {
  throw "Packaged executable was not found in release/win-unpacked."
}

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $appDirectory "*") -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "Created $zipPath"
