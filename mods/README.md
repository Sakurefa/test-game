# Mods

Mod packages use a mixed INI + optional JavaScript format. Read [MOD_API.md](../MOD_API.md) for the complete contract.

- core/ is required and always enabled.
- Manifests, registries, entity definitions and localization remain INI.
- Content uses stable IDs and [type.id] sections; player-visible text lives in locale INI files.
- Initial population groups may be declared as `[population_group.<id>]` sections with `colony_id`, `population` and independent `dimension.<id>` distributions. The sum of declared group counts is the colony's complete initial population. No automatic remainder is added. Only when no Mod defines any group does the Engine create one neutral `unclassified` group using the colony definition's `population` value as the fallback starting count.
- API v3 packages remain INI-only and continue to load.
- API v4 packages may declare scripts/ JavaScript files and explicit hooks in manifest.ini.
- Hooks receive detached read-only input and return approved effect/event data. They cannot write arbitrary world fields or call Node/Electron services.
- JSON Mod files and inline JSON values are rejected.
- The current vm runner reduces exposed capabilities but is not a hardened boundary against deliberately hostile code. Enable only trusted JS Mods.

- `trigger-test/` is an optional automated/manual validation scenario for Trigger, Resolution and Effect contracts. It is disabled by default and can be enabled temporarily for a fresh test campaign; it is not part of baseline Core gameplay.
