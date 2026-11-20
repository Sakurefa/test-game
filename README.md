# Market Simulator

A moddable Windows desktop stock-market simulation game built with Electron,
Vite, HTML, CSS, and JavaScript.

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

The portable Windows x64 executable is written to `release/`. The packaged
app includes its own Electron/Chromium runtime; end users do not need to
install Chrome, Node.js, or npm.

## Automatic Windows builds

GitHub Actions builds the portable Windows executable on pushes to `main`,
pull requests targeting `main`, and manual workflow dispatches.

- Open the repository's **Actions** tab and select **Build Windows Game**.
- Open a completed run and download the `Market-Simulator-Windows` artifact.
- To publish a shareable GitHub Release, push a version tag such as
  `v0.1.0`. The workflow attaches the Windows executable to that release.

Release tag example:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Project layout

- `electron/` — Electron main process and restricted preload bridge
- `src/` — renderer UI and game modules
- `src/core/` — reusable engine services such as audio
- `data/` — default game data and configuration
- `mods/` — mod format documentation and future mod packages

## Local saves

Save data is stored under Electron's per-user application data directory,
inside a `saves/` folder. The renderer accesses it through a narrow preload
API; it does not receive direct Node.js or filesystem access.

## Mod safety

The initial mod system is planned around declarative data files. Executable
JavaScript mods will require a separately designed, restricted plugin API.
