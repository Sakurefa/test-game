$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$appDirectory = Join-Path $projectRoot "electron-app"
$bootstrapSource = Join-Path $projectRoot "electron/bootstrap.cjs"
if (-not (Test-Path $bootstrapSource -PathType Leaf)) { throw "Missing Electron bootstrap: $bootstrapSource" }
if (Test-Path $appDirectory) { Remove-Item $appDirectory -Recurse -Force }
New-Item -ItemType Directory -Path $appDirectory -Force | Out-Null
Copy-Item $bootstrapSource (Join-Path $appDirectory "bootstrap.cjs") -Force
$runtimeManifest = @{
  name = "market-simulator-launcher"
  version = "0.1.0"
  description = "External launcher for the Market Simulator repository"
  author = "Sakurefa"
  private = $true
  main = "bootstrap.cjs"
}
$manifestJson = $runtimeManifest | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $appDirectory "package.json"), $manifestJson, $utf8NoBom)
Write-Host "Prepared minimal Electron bootstrap: $appDirectory"
