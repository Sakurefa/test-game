# Market Simulator

A moddable Windows desktop stock-market simulation game built with Electron,
Vite, HTML, CSS, and JavaScript.

## Requirements

- Windows 10 or later for the packaged Windows build
- Node.js 20 or later (Node.js 22 LTS recommended)
- npm

## Development

```bash
npm install
npm run dev
```

Vite serves the renderer locally and Electron opens the desktop window.

## Build

```bash
npm run build:win
```

The portable Windows build is written to `release/`. The packaged app includes
its own Electron/Chromium runtime; end users do not need to install Chrome.

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
