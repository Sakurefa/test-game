# Frontier Simulation

A moddable desktop simulation about a connected frontier of star systems, colonies, production networks, markets, fleets and wars. Built with Electron, Vite and plain web technologies.

## Run from source

- Install Node.js 20 or newer.
- Run `npm install`.
- Run `npm run dev` for development.
- Run `npm test` for automated tests.
- Run `npm run check:syntax` to parse-check Electron and engine CommonJS modules.
- Run `npm run build:web` to build the renderer.

## Portable game layout

The GitHub repository contains the editable game source and the Electron runtime files. The standalone Windows launcher is distributed separately and is not committed to this repository.

For portable play, extract the repository ZIP, place the separately distributed `Market Simulator.exe` beside the repository files, and launch it. The executable supplies Electron/Chromium; the game itself is loaded from the adjacent repository directory.

The game creates and uses these directories beside the executable:

- `Logs/`: startup log plus rotating runtime logs.
- `setting/`: editable INI settings.
- `save/`: save slots and world data.

The game directory must be writable. The application will show an error rather than silently moving these files into an unrelated user profile directory.

## Simulation architecture

The world simulation is the center of the project. Markets and securities are only one part of a larger world that also contains star systems, colonies, resources, industries, companies, fleets and wars.

The authoritative simulation is plain Node.js under `engine/`, separate from Electron and the renderer. The Electron main process owns the continuous campaign clock; the renderer only displays snapshots and sends time-control commands. The initial base rate is one game day per 60 real seconds at 1x, adjustable through `setting/simulation.ini`. Market/security quotes and war chronology update daily; colony production runs every seven elapsed game days. New and loaded worlds start paused.

See [docs/ENGINE_ARCHITECTURE.md](docs/ENGINE_ARCHITECTURE.md) for subsystem boundaries and the current prototype limits. The hands-on [playtest guide](docs/PLAYTEST_GUIDE.md) lists the exact checks to perform after downloading the updated source.

## Modding

Mod packages are **INI-only**: manifests, registry declarations, content definitions and localization all use INI. The required `mods/core/` package declares the base universe and core definitions. Community packages use the same structure. JSON Mod files and inline JSON values are rejected; Mods cannot execute scripts or alter engine code.

See [MOD_API.md](MOD_API.md) for the API v3 format and safety limits.

## Current prototype status

Implemented foundations include multi-system universe data, cross-reference validation, a pause/1x–4x continuous campaign clock, dependency-ordered daily/weekly simulation systems, versioned world-save migration, deterministic random state, colony production, market repricing, fleet/war definitions and automated engine tests.

This is an early simulation slice, not a finished strategy game. Real-time tactical battles, fleet movement, inter-colony logistics, diplomacy, taxation, debt, player trading orders and long-term colony development remain future systems.
