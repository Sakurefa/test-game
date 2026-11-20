# Mods

This directory contains the required first-party data package and optional community data packages.

- `core/` is the required base game-content package and is always enabled.
- `registry/` declares content identities and references.
- `content/` stores game data.
- `localization/` stores translated strings keyed by stable IDs.
- Community packages use the same data-only format.

Mods cannot contain executable code, scripts or runtime hooks. Read [MOD_API.md](../MOD_API.md) for the manifest, INI syntax, limits and installation rules.
