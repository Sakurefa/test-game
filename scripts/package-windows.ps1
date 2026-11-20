$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$appDirectory = Join-Path $root "release/win-unpacked"
$zipPath = Join-Path $root ("release/Market-Simulator-" + $package.version + "-Windows-x64.zip")

$requiredFiles = @(
  "Market Simulator.exe",
  "resources/app/package.json",
  "resources/app/electron/main.cjs",
  "resources/app/electron/preload.cjs",
  "resources/app/dist/index.html",
  "mods/README.md",
  "mods/example-market/manifest.json",
  "mods/example-market/data/market-events.json",
  "source/electron/main.cjs",
  "source/electron/preload.cjs",
  "README.md",
  "MOD_API.md"
)

foreach ($relativePath in $requiredFiles) {
  $fullPath = Join-Path $appDirectory $relativePath
  if (-not (Test-Path $fullPath -PathType Leaf)) {
    throw "Required packaged file is missing: $relativePath"
  }
}

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $appDirectory "*") -DestinationPath $zipPath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $archiveEntries = @{}
  foreach ($entry in $archive.Entries) {
    $archiveEntries[$entry.FullName.Replace("\\", "/")] = $true
  }

  foreach ($relativePath in $requiredFiles) {
    if (-not $archiveEntries.ContainsKey($relativePath)) {
      throw "ZIP verification failed; required entry is missing: $relativePath"
    }
  }
}
finally {
  $archive.Dispose()
}

Write-Host "Verified $($requiredFiles.Count) required files in the unpacked app and ZIP."
Write-Host "Created $zipPath"
