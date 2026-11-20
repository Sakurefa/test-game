# Mods

This is the external Mod directory included beside the game executable in the Windows ZIP release.

For the current folder layout, manifest format, host API and limits, read [MOD_API.md](../MOD_API.md).

API v1 supports data-only JSON Mods. It does not execute JavaScript. The game currently discovers and validates installed Mods, but the title screen does not yet apply their data to gameplay.

Install a Mod by copying its folder here. Each Mod must contain a `manifest.json` and any declared JSON files inside `data/`.
