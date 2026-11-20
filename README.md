# Market Simulator

A moddable Windows desktop stock-market simulation game built with Electron, Vite, HTML, CSS, and JavaScript.

## Play

The repository contains the editable game source and the Electron runtime files required to run it. The large launcher executable is distributed separately.

1. Download the repository using **Code → Download ZIP** and extract it.
2. Obtain the matching `Market Simulator.exe` launcher from the project maintainer.
3. Put that EXE in the extracted repository root, beside `electron/`, `src/`, `mods/`, `resources/`, and `locales/`.
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

## Project layout

- `electron/` — desktop host, preload bridge, Mod discovery and INI parser
- `src/` — renderer UI and engine-side frontend modules
- `dist/` — generated renderer output used at runtime
- `mods/core/` — required first-party game-content package; future gameplay content belongs here
- `mods/<mod-id>/` — optional community content packages
- `resources/`, `locales/`, root DLL/Pak files — Electron runtime dependencies
- `MOD_API.md` — Mod API v2 and INI format specification

## Content architecture

The project separates engine code from game content. Engine code handles execution and infrastructure; game definitions, balance, scenarios, events, items, characters and other non-engine content are intended to live in `mods/core/`, primarily as editable INI files. The core package is currently only a validated structural placeholder; existing game content has not yet been migrated.

## Local saves

Save data is stored under Electron's per-user application data directory, inside a `saves/` folder.

## Mods

The required `mods/core/` package supplies the first-party content base. Optional Mods are installed as sibling folders under `mods/`. API v2 supports data-only INI and JSON files; it does not execute JavaScript. See [MOD_API.md](MOD_API.md).
