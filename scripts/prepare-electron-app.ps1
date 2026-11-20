$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$appDirectory = Join-Path $projectRoot "build\app"
$electronSource = Join-Path $projectRoot "electron"
$distSource = Join-Path $projectRoot "dist"

if (-not (Test-Path (Join-Path $electronSource "main.cjs"))) {
  throw "Missing Electron main process: $electronSource"
}
if (-not (Test-Path (Join-Path $electronSource "preload.cjs"))) {
  throw "Missing Electron preload: $electronSource"
}
if (-not (Test-Path (Join-Path $distSource "index.html"))) {
  throw "Missing Vite output: $distSource"
}

if (Test-Path $appDirectory) {
  Remove-Item $appDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $appDirectory "electron") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $appDirectory "dist") -Force | Out-Null

Copy-Item (Join-Path $electronSource "*.cjs") (Join-Path $appDirectory "electron") -Force
Copy-Item (Join-Path $distSource "*") (Join-Path $appDirectory "dist") -Recurse -Force

$runtimeManifest = @{
  name = "stock-market-simulator"
  version = "0.1.0"
  description = "A moddable desktop stock-market simulation game."
  author = "Sakurefa"
  private = $true
  main = "electron/main.cjs"
}
$runtimeManifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $appDirectory "package.json") -Encoding utf8NoBOM

Write-Host "Prepared clean Electron app directory: $appDirectory"
Get-ChildItem $appDirectory -Recurse | Select-Object FullName
