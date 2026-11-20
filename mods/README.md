# Mods

This directory contains the required first-party content package and optional community content packages.

- `core/` is the required base game-content package. Future game definitions and non-engine content belong here, primarily in editable `.ini` files.
- Other folders are optional community Mods, each with its own `manifest.json` and `data/` directory.

The core package is currently a structural placeholder. Actual gameplay content is deliberately not part of this architecture pass.

For package layout, manifest fields, INI syntax, host APIs and safety limits, read [MOD_API.md](../MOD_API.md).
