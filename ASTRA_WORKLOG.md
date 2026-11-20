# Astra project work log

> **Mandatory:** Read this entire file before every work session. Update it before ending every work session. Root `AGENTS.md` repeats this requirement and defines the project-specific hard rules.

## Project identity

- Repository: [Sakurefa/test-game](https://github.com/Sakurefa/test-game)
- Default branch: `main`
- Game: moddable multi-system frontier simulation.
- Stack: Electron + Chromium + Vite + Node.js.
- Current phase: simulation foundation and Mod/content architecture.

## Non-negotiable decisions

1. **Mod data is INI-only.** Game definitions, registry declarations, Mod manifests and localization data must use INI. JSON is not an acceptable Mod data format. The root npm `package.json`, lockfile and internal save/runtime serialization are tooling/runtime concerns, not Mod package data.
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

## Latest verified repository state — 2026-11-20

- Latest verified source/build commit (excluding this log-only update): `57cd1c68d12e5348157f1f0abaabc60b4698b0f9`.
- Source commit tested by CI: `d3647c9043cd948c083fcc674edfc8153672471b`.
- GitHub Actions run [44769774977](https://github.com/Sakurefa/test-game/actions/runs/44769774977) completed successfully:
  - Node syntax checks: passed.
  - Simulation and Mod loader tests: passed.
  - Vite renderer build: passed.
  - Generated renderer files were committed by the workflow as `57cd1c68d12e5348157f1f0abaabc60b4698b0f9`.
- The Mod tree contains only INI package files; there are no tracked JSON files under `mods/`.
- Core uses `manifest.ini`, `registry/definitions.ini`, `content/*.ini` and `localization/zh-CN.ini`.
- The example Mod also uses INI manifest, registry, content and localization files. Its event text is referenced by localization keys.
- Mod loader accepts only declared `.ini` files and parses them in strict mode, rejecting inline JSON arrays/objects. The generic INI parser still supports inline JSON values by default for unrelated existing game settings such as `setting/mods.ini`; this compatibility is intentional and must not be removed without migrating those settings too.
- `MOD_API.md`, `README.md`, `mods/README.md` and `docs/ENGINE_ARCHITECTURE.md` document the INI-only contract.
- Root `AGENTS.md` and this work log establish the mandatory start/end session protocol.
- **No Windows desktop test has been performed for this exact revision.** The user previously launched an earlier build and observed a day advance, but has not validated the correctness of the simulation numbers.

## Current work queue

### Priority 1 — simulation correctness and transparency
- Add deterministic expected-value tests for production inputs/outputs, price movement, market stock coupling and war-day progression.
- Ensure the UI explains daily changes so the user can see why values changed.
- Check for production exploits, stockpile underflow, unbounded prices, and markets whose quotes are disconnected from actual supply/demand.
- Do not assume a changed value is a correct value.

### Priority 2 — localization completeness
- Audit all player-visible text in the renderer and ensure it resolves through localization.
- Check government labels and commodity units as well as names/descriptions.
- Language selection UI is not yet implemented; default locale remains zh-CN.

### Priority 3 — content and engine growth
1. Colony simulation: workforce, population needs, facility upkeep, stability, construction and colony development.
2. Logistics: freighters and convoys travel through route graphs, consume time/capacity/risk and move physical stock.
3. Economic agency: company accounting, operating costs/revenue, player orders, ownership, fees, debt and reporting.
4. Strategic warfare: fleet movement/orders, supply, fronts, objectives, faction AI and territorial change.
5. Tactical combat: separate real-time battle instances, ship behavior/orders, damage and campaign outcome application.
6. Living world: events, diplomacy, policies and additional community scenarios.

## Session log

### 2026-11-20 — INI contract correction, migration and verification

- User identified that the prior implementation used JSON for Mod content despite the explicit INI requirement.
- User requested a root-level work log that Astra must read before work and update after work.
- Added root `AGENTS.md` and `ASTRA_WORKLOG.md`; the former mandates reading and updating the latter for every work session.
- Migrated Core universe, economy, factions, military and events definitions from JSON to INI.
- Migrated registry declarations to `definitions.ini` and both Mod manifests to `manifest.ini`.
- Migrated the example Mod event to `name_key` and `description_key`, and added its own `zh-CN.ini` localization.
- Removed all JSON files from `mods/`.
- Updated the Mod loader to accept only INI package files and normalize section-based definitions into engine objects. Mod parsing rejects inline JSON values.
- Preserved generic INI parser compatibility for the existing settings system; strict rejection is scoped to Mod package files.
- Updated catalog registry loading, engine and loader tests, Mod API docs, architecture docs, Mod README and root README.
- Initial CI attempt exposed that generic settings INI also uses inline JSON arrays. The parser was corrected to support the legacy generic mode while enforcing strict Mod mode.
- Final CI run 44769774977 passed syntax checks, all tests and renderer build. Workflow generated and committed updated `dist/` output.
- No local Windows runtime test was performed.
- Next: begin a correctness audit of daily simulation, starting with production input/output arithmetic and market repricing. Ask the user to test the updated ZIP + separately distributed launcher only when a Windows check becomes necessary.
