# Market Simulator

A moddable Windows desktop stock-market simulation game built with Electron,
Vite, HTML, CSS, and JavaScript.

## Play the Windows build

Download the Windows ZIP from GitHub Actions or the Releases page, extract the
whole folder, then run `Market Simulator.exe`. Keep the `mods/` directory
beside the executable. The app includes its own Electron/Chromium runtime;
players do not need to install Chrome, Node.js, or npm.

The extracted folder also includes a `source/` snapshot for people who want to
inspect the renderer and Electron host code. The canonical development source
and contribution history live in this GitHub repository.

## Development

- Node.js 22 LTS (Node.js 20 or later is supported)
- npm

```bash
npm install
npm run dev
```

Vite serves the renderer locally and Electron opens the desktop window.

## Build locally (optional)

```bash
npm run build:win
```

The build creates an unpacked Windows x64 application in `release/win-unpacked/`
and a shareable ZIP in `release/Market-Simulator-<version>-Windows-x64.zip`.

## Automatic Windows builds

GitHub Actions builds the Windows ZIP on pushes to `main`, pull requests
targeting `main`, and manual workflow dispatches.

- Open the repository's **Actions** tab and select **Build Windows Game**.
- Open a completed run and download the `Market-Simulator-Windows` artifact.
- To publish a shareable GitHub Release, push a version tag such as `v0.1.0`.
  The workflow attaches the Windows ZIP to that release.

## Project layout

- `electron/` — Electron main process and restricted preload bridge
- `src/` — renderer UI and game modules
- `src/core/` — reusable engine services
- `data/` — default game data and configuration
- `mods/` — external data Mods and examples
- `MOD_API.md` — Mod API v1 specification
- `scripts/` — build and packaging helpers

## Local saves

Save data is stored under Electron's per-user application data directory,
inside a `saves/` folder. The renderer accesses it through a narrow preload
API; it does not receive direct Node.js or filesystem access.

## Mods

Mod API v1 supports data-only JSON packages. Mods are installed by copying a
Mod folder into the external `mods/` directory beside the executable. The host
validates manifests and JSON files and exposes a restricted discovery/loading
bridge to the renderer. JavaScript Mods and runtime hooks are not enabled in
v1. See [MOD_API.md](MOD_API.md) for the full format and compatibility rules.
