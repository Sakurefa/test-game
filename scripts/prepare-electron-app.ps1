$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$appDirectory = Join-Path $projectRoot "electron-app"
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
$manifestJson = $runtimeManifest | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $appDirectory "package.json"), $manifestJson, $utf8NoBom)

Write-Host "Prepared clean Electron app directory: $appDirectory"
Get-ChildItem $appDirectory -Recurse | Select-Object FullName
