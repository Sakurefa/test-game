# Market Simulator

A moddable Windows desktop stock-market simulation game built with Electron, Vite, HTML, CSS, and JavaScript.

## Play

The repository contains the editable game source and the Electron runtime files required to run it. The large launcher executable is distributed separately.

1. Download the repository using **Code → Download ZIP** and extract it.
2. Obtain the matching `Market Simulator.exe` launcher from the project maintainer.
3. Put that EXE in the extracted repository root, beside `electron/`, `src/`, `resources/`, and `locales/`.
4. Run `Market Simulator.exe`.

Do not move the EXE away from the repository folder. The launcher uses the Electron runtime beside it and loads the game from this repository. The launcher and checked-in Electron runtime must come from the same Electron version.

## Development

- Node.js 22
- npm

```bash
npm install
npm run dev
```

## Tests and renderer build

```bash
npm test
npm run build:web
```

The generated `dist/` directory is committed by GitHub Actions so the fixed launcher can load the latest renderer without bundling game data into the EXE.

## Electron runtime maintenance

The Electron runtime files in the repository are generated from the pinned Electron version in `package.json`. Run the **Prepare Electron Runtime and Launcher** workflow only when initially preparing the runtime or intentionally upgrading Electron.

That workflow synchronizes all required runtime files into the repository, deliberately excludes the large launcher EXE from Git, and provides the EXE as a temporary Actions artifact. Download it and distribute it separately (for example, through the project QQ group).

## Project layout

- `electron/` — Electron main process, preload bridge and minimal bootstrap
- `src/` — renderer UI and game modules
- `dist/` — generated renderer output used at runtime
- `data/` — default game data and configuration
- `mods/` — external data Mods and examples
- `resources/`, `locales/`, root DLL/Pak files — Electron runtime dependencies
- `MOD_API.md` — Mod API v1 specification

## Local saves

Save data is stored under Electron's per-user application data directory, inside a `saves/` folder.

## Mods

Mod API v1 supports data-only JSON packages. Install Mods into the repository's root `mods/` directory. JavaScript Mods and runtime hooks are not enabled in v1. See [MOD_API.md](MOD_API.md).
