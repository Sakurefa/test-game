# Mods

Mod packages use a mixed INI + optional JavaScript format. Read [MOD_API.md](../MOD_API.md) for the complete contract.

- core/ is required and always enabled.
- Manifests, registries, entity definitions and localization remain INI.
- Content uses stable IDs and [type.id] sections; player-visible text lives in locale INI files.
- Initial population groups may be declared as `[population_group.<id>]` sections with `colony_id`, `population` and independent `dimension.<id>` distributions. All declared groups for a colony must sum to its configured population; otherwise the Engine supplies one neutral group.
- API v3 packages remain INI-only and continue to load.
- API v4 packages may declare scripts/ JavaScript files and explicit hooks in manifest.ini.
- Hooks receive detached read-only input and return approved effect/event data. They cannot write arbitrary world fields or call Node/Electron services.
- JSON Mod files and inline JSON values are rejected.
- The current vm runner reduces exposed capabilities but is not a hardened boundary against deliberately hostile code. Enable only trusted JS Mods.
