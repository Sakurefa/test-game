# Market Simulator

A moddable desktop stock-market simulation project built with Electron, Vite and plain web technologies.

## Run from source

- Install Node.js 20 or newer.
- Run `npm install`.
- Run `npm run dev` for development.
- Run `npm test` for automated tests.
- Run `npm run build:web` to build the renderer.

## Portable game layout

The GitHub repository contains the editable game source and the Electron runtime files. The standalone Windows launcher is distributed separately and is not committed to this repository.

For portable play, extract the repository ZIP, place the separately distributed `Market Simulator.exe` beside the repository files, and launch it. The executable supplies Electron/Chromium; the game itself is loaded from the adjacent repository directory.

The game creates and uses these directories beside the executable:

- `Logs/`: startup log plus four rotating runtime log files.
- `setting/`: editable INI settings (`general.ini`, `graphics.ini`, `audio.ini`, `mods.ini`).
- `save/`: save slots and save data.

The game directory must be writable. The application will show an error rather than silently moving these files into an unrelated user profile directory.

## Modding

Mods are data-only packages. The required `mods/core/` package contains registry, content and localization data. Community packages use the same structure. Mod packages cannot execute scripts or alter engine code.

See [MOD_API.md](MOD_API.md) for the API v3 format and safety limits.

## Project status

The project currently has its portable runtime architecture, data-only Mod loader, root-level storage services, logging foundation and title menu. Actual world simulation and gameplay systems are still under construction.
