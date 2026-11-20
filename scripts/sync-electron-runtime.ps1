$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$builtApp = Join-Path $root "release/win-unpacked"
$launcher = Join-Path $builtApp "Market Simulator.exe"
if (-not (Test-Path $launcher -PathType Leaf)) { throw "Electron launcher was not produced: $launcher" }
$items = Get-ChildItem $builtApp -Force | Where-Object { $_.Name -ne "Market Simulator.exe" }
if (-not ($items | Where-Object { $_.Name -eq "resources" -and $_.PSIsContainer })) { throw "Electron runtime resources directory is missing." }
foreach ($item in $items) {
  $destination = Join-Path $root $item.Name
  if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
  Copy-Item $item.FullName $destination -Recurse -Force
}
$required = @("resources/app/package.json","resources/app/bootstrap.cjs","electron/main.cjs","electron/preload.cjs","dist/index.html")
foreach ($relative in $required) {
  if (-not (Test-Path (Join-Path $root $relative) -PathType Leaf)) { throw "Runtime layout verification failed: $relative" }
}
$tooLarge = Get-ChildItem $root -Recurse -File | Where-Object { $_.Length -ge 90MB -and $_.FullName -notlike (Join-Path $root ".git*") }
if ($tooLarge) { throw "At least one runtime dependency is 90 MiB or larger: $($tooLarge[0].FullName)" }
Write-Host "Synchronized Electron runtime files into repository root."
Write-Host "The launcher EXE is intentionally excluded from the repository."
