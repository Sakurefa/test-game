# Astra project work log

> **Mandatory:** Read this entire file before every work session. Update it before ending every work session. The root `AGENTS.md` repeats this requirement so future coding agents are directed here first.

## Project identity

- Repository: [Sakurefa/test-game](https://github.com/Sakurefa/test-game)
- Default branch: `main`
- Game: moddable multi-system frontier simulation.
- Stack: Electron + Chromium + Vite + Node.js.
- Current phase: simulation foundation and Mod/content architecture.

## Non-negotiable decisions

1. **Mod data is INI-only.** Game definitions, registry declarations, Mod manifests and localization data must use INI. JSON is not an acceptable Mod data format. The root `package.json`, lockfile and internal save/runtime serialization are tooling/runtime concerns, not Mod package data.
2. **Localization is separate.** Names, descriptions, government labels, commodity units and other player-visible text live in locale INI files. Content refers to stable localization keys; do not embed translated display text in definitions.
3. **Stable IDs are language-independent.** IDs are machine-facing and must not be translated.
4. **Mods are data-only.** No JavaScript, scripts, native code, runtime hooks or executable patches in Mods.
5. **Core is required and always enabled.**
6. **Distribution model:** the repository contains the complete editable game source and Electron runtime files; the standalone launcher EXE is distributed separately (for example through the user's QQ group), not committed to the repository. The launcher loads the game from its adjacent repository directory.
7. **Do not claim tests passed unless they actually passed.** CI, local checks and user-side Windows testing must be reported separately.

## Current world prototype

The initial world is the Helios frontier:
- Four systems: Solace, Cinder, Eos and Veil.
- Three colonies and three factions.
- Commodities, production recipes, markets, companies/securities, fleets, wars and events.
- Daily simulation currently changes production stocks, market prices and war duration.
- This is a prototype, not yet a full logistics, colony management, trading, financial or RTS implementation.

Long-term direction:
1. Deepen colonies: population demand, labor, maintenance, facilities, stability and expansion.
2. Implement actual interstellar logistics: freighters, cargo orders, route capacity, travel time, risk and stock transfers.
3. Build company economics and player finance: balance sheets, cash flow, trading, positions, credit and dividends.
4. Build strategic warfare: fleet movement, supply, front lines, territory, war goals and faction AI.
5. Separate real-time tactical combat from strategic world time.
6. Add dynamic events, diplomacy and systemic world changes.

## Latest known repository state (2026-11-20)

- Previously known localization work was committed around `e082e3433750aa7e498043d6010f8739b9d2f403`.
- Content definitions were moved to localization keys (`nameKey`, `descriptionKey`, `governmentKey`, `unitKey`) and Chinese strings were added to `mods/core/localization/zh-CN.ini`.
- **Important defect:** the content definitions and registry still use JSON, despite the project's explicit INI-only Mod data requirement. This must be migrated; do not treat the localization change as sufficient.
- **Important CI failure:** workflow run [44766621802](https://github.com/Sakurefa/test-game/actions/runs/44766621802) completed with failure. The failing test reports: `Event example-positive-news requires a localization nameKey`. The optional example Mod still embeds display text in JSON and has no localization key. The renderer build was skipped because tests failed.
- CI syntax check passed; npm install completed; simulation/Mod tests failed; renderer build was skipped. Do not describe this commit as green.
- The user has successfully launched a previous Windows build and observed that advancing one day changes values. They have not confirmed the correctness of the economic simulation, nor tested the current localization changes on Windows.

## Current work queue

### Priority 0 — enforce INI-only Mod packages
- Migrate Core content definitions from JSON to INI.
- Migrate registry declarations to INI.
- Migrate Mod manifests to INI.
- Keep locale files in INI.
- Remove JSON parsing support from Mod package loading (do not confuse the root npm `package.json` with Mod data).
- Design a readable INI convention for repeated entities, lists, maps, nested recipe inputs/outputs, colony stockpiles/industries and fleet ship composition.
- Update Core and example Mod manifests/file declarations.
- Update MOD_API.md and architecture docs so examples are INI-only and unambiguous.
- Add tests proving JSON Mod files are rejected/not loaded and INI definitions compile correctly.

### Priority 1 — fix current failing CI
- Add localization keys for every example Mod event.
- Update example Mod content to the same INI-only contract.
- Ensure the catalog compiler validates all enabled Mods' localization references.
- Re-run syntax, tests and renderer build in GitHub Actions; inspect the exact failing step/logs.

### Priority 2 — audit localization completeness
- Verify no player-facing text remains embedded in Mod content.
- Verify every entity display name and optional description/government/unit reference resolves.
- Ensure renderer displays resolved localization values rather than raw keys or IDs.
- Language selection UI is not yet implemented; default locale remains zh-CN.

### Priority 3 — simulation correctness
- Add deterministic expected-value tests for production inputs/outputs, price movement, market stock coupling and war-day progression.
- Explain daily simulation effects in UI so the user can tell what changed.
- Do not assume a changed value is a correct value.

## Session log

### 2026-11-20 — INI contract correction and workflow log setup

- User identified that the previous implementation used JSON for Mod content despite the explicit INI requirement.
- User requested a root-level work log that Astra must read at the start and update at the end of every work session.
- Inspected repository root, recursive file tree, current catalog compiler, Mod loader, INI parser, Core Mod data, example Mod and GitHub Actions run 44766621802.
- Confirmed Core uses `universe.json`, `economy.json`, `factions.json`, `military.json`, `events.json`; registry uses `definitions.json`; both Core and example Mod use `manifest.json`.
- Confirmed the current INI parser still permits inline JSON arrays/objects. This is not suitable as the final INI-only contract and must be corrected or explicitly removed.
- Confirmed CI run 44766621802 failed during `npm test`: example event `example-positive-news` has no localization `nameKey`. Renderer build was skipped.
- No Windows runtime test was performed in this session.
- Next: implement an actual INI-only Mod schema, migrate all Mod package data and fixtures, update docs/tests, then verify CI. Keep this log updated as work proceeds.
