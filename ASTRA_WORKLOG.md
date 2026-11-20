# Astra project work log

> **Mandatory:** Read this entire file before every work session. Update it before ending every work session. Root `AGENTS.md` repeats this requirement and defines the project-specific hard rules.

## Project identity

- Repository: [Sakurefa/test-game](https://github.com/Sakurefa/test-game)
- Default branch: `main`
- Game: moddable multi-system frontier simulation.
- Stack: Electron + Chromium + Vite + Node.js.
- Current phase: continuous campaign-time kernel and extensible simulation foundation; next is deterministic named RNG and calculation audit services.

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
- Market/security quotes and war chronology update daily; colony industrial production is scheduled every seven elapsed game days (day 7, 14, 21…).
- This is a prototype, not yet a full logistics, colony management, trading, financial or RTS implementation.

Long-term direction:
1. Deepen colonies: population demand, labor, maintenance, facilities, stability and expansion.
2. Implement actual interstellar logistics: freighters, cargo orders, route capacity, travel time, risk and stock transfers.
3. Build company economics and player finance: balance sheets, cash flow, trading, positions, credit and dividends.
4. Build strategic warfare: fleet movement, supply, front lines, territory, war goals and faction AI.
5. Separate real-time tactical combat from strategic world time.
6. Add dynamic events, diplomacy and systemic world changes.

## Latest verified repository state — 2026-11-21

- Latest source commit: `0e412336c4f2f1be0ad7f4620a2fd88b630d2247`.
- Latest main branch commit including generated renderer files: `0915f4de98084391e4d35576e4fcf1c3c7ed7c59`.
- GitHub Actions run [44782960920](https://github.com/Sakurefa/test-game/actions/runs/44782960920) completed successfully for the source commit:
  - Electron/engine syntax checks: passed.
  - Full automated suite: 41 passed, 0 failed.
  - Vite renderer build: passed.
  - Generated renderer files were committed by the workflow as `0915f4de98084391e4d35576e4fcf1c3c7ed7c59` (`dist/index.html` and hashed JS/CSS assets).
- An initial CI run [44782725042](https://github.com/Sakurefa/test-game/actions/runs/44782725042) correctly exposed one simulation-system ordering assertion (40/41 passed). The topological ordering implementation was fixed in `0e41233`, and the complete suite then passed.
- The companion runtime workflow [44782725039](https://github.com/Sakurefa/test-game/actions/runs/44782725039) stopped at the same test failure before building a launcher. The subsequent fix changed only the engine registry; the existing separately distributed Electron launcher remains compatible because it loads `electron/main.cjs`, preload and `dist/` from the adjacent repository directory. No new EXE was produced in this session.
- The Mod tree contains only INI package files; there are no tracked JSON files under `mods/`.
- Core uses `manifest.ini`, `registry/definitions.ini`, `content/*.ini` and `localization/zh-CN.ini`.
- The example Mod also uses INI manifest, registry, content and localization files. Its event text is referenced by localization keys.
- Mod loader accepts only declared `.ini` files and parses them in strict mode, rejecting inline JSON arrays/objects. The generic INI parser still supports inline JSON values by default for unrelated existing game settings such as `setting/mods.ini`; this compatibility is intentional and must not be removed without migrating those settings too.
- `MOD_API.md`, `README.md`, `mods/README.md` and `docs/ENGINE_ARCHITECTURE.md` document the INI-only contract.
- Root `AGENTS.md` and this work log establish the mandatory start/end session protocol.
- **No Windows desktop test has been performed for this exact revision.** The user previously launched an earlier build and observed a day advance, but has not validated the correctness of the simulation numbers.

## Current work queue

### Priority 1 — deterministic calculations and simulation correctness
- The time kernel now runs continuously and has ordered daily/weekly systems. The engine still uses one shared PRNG stream and does not yet emit structured calculation traces.
- Implement named random streams per stable subsystem/entity scope so new systems cannot perturb unrelated random sequences.
- Add a versioned formula registry and structured audit records with inputs, modifiers, intermediate values, random draws (only when actually used), and results.
- Add deterministic expected-value tests for production inputs/outputs and market repricing; audit stockpile underflow, unbounded prices and supply/demand coupling.
- The calculation visibility toggle must never change RNG consumption or simulation results.

### Priority 2 — presentation and assets
- Establish renderer-neutral scene and asset contracts before choosing/locking a 2D renderer dependency.
- Add resource identity, validation, cache and lifecycle boundaries for textures/images, animation/sprites, particles, audio and fonts.
- Keep DOM for menus/panels and allow a scene backend for the star map, colonies and later other non-combat scenes. Tactical combat is explicitly deferred.

### Priority 3 — help, accessibility and localization
- Implement localization-backed contextual help with 2–3 content sections: immersive world principle, actual gameplay/numeric mechanics, and contextual navigation when useful.
- Ensure formula IDs in help resolve to real calculation implementations.
- Add delayed tooltip handling, separate interface/floating-text font settings and safe font discovery.
- Audit all player-visible text and localization completeness.

### Priority 4 — world systems and content
1. Colony simulation: workforce, population needs, facility upkeep, stability, construction and development.
2. Logistics: freighters and convoys move physical stock through route graphs using travel time, capacity and risk.
3. Economic agency: company accounts, operating costs/revenue, player orders, ownership, fees, debt and reporting.
4. Strategic warfare: fleet movement/orders, supply, fronts, objectives, faction AI and territorial change.
5. Living world: events, diplomacy, policies, missions and community scenarios.
6. Tactical combat is a separate later project with its own fixed-step clock and explicit campaign outcomes; do not put it in the current campaign scheduler.

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


### 2026-11-21 — transition to continuous-time 2D simulation (architecture review)

- User established four new foundation directions:
  1. Replace turn/day-step play with continuous campaign time; pause, run and 1x–4x speed controls, with Victoria 3 as the interaction reference. Most systems update weekly; sensitive systems update daily.
  2. Add an optional calculation/RNG visibility toggle beside time controls. Visible calculation traces should show formulas, modifiers, random rolls and outcomes beside changing values.
  3. Move from text-card presentation toward a real 2D game with dynamic market charts, battle scenes, colony visuals and changing environmental backgrounds.
  4. Add delayed contextual tooltips and independent interface/floating-text font selections, with font discovery from the repository `fonts/` folder and OS font folders.
- Read this file and `AGENTS.md` before the review. Inspected current `engine/clock.cjs`, `engine/random.cjs`, `engine/simulation.cjs`, `engine/catalog.cjs`, `electron/main.cjs`, `electron/preload.cjs`, `electron/storage.cjs`, `src/main.js`, `src/world.js`, `src/styles.css`, `package.json` and architecture/playtest docs.
- Current engine is still strictly day-step based: `advanceDay` executes production, market repricing and war chronology as one daily batch. The renderer offers a single “advance one day” action; no campaign time scheduler or speed controls exist.
- Current random generator is one saved global PRNG stream. It is deterministic, but it is not yet isolated by subsystem/entity and does not emit calculation/audit records.
- Current presentation is DOM/CSS card-based; no 2D scene renderer, chart history model, scene asset contract or animation loop exists.
- Settings are generated at runtime as schema-validated INI files by `electron/storage.cjs`; graphics settings are stored in `setting/graphics.ini`, and new simulation timing is stored in `setting/simulation.ini`.
- Recommended architecture direction: keep the authoritative simulation in Node; add a main-process-owned campaign clock controller and deterministic event scheduler; use a calendar timestamp with day/week boundaries and fixed ordered simulation phases; keep strategic campaign time separate from tactical battle fixed-step time; make 1x–4x a multiplier over a separately tunable base real-time rate.
- Recommended RNG/formula direction: replace the single shared random stream with stable named streams; introduce a versioned formula/roll service that emits structured trace records independent of the display toggle; display traces in a compact inspector/inline annotation without allowing UI visibility to change outcomes.
- Recommended presentation direction: retain DOM for menus and controls, add a dedicated 2D scene layer (recommend evaluating PixiJS for map/colony/battle scenes) with Canvas/SVG charts and DOM overlays; define renderer-independent snapshots and asset IDs. Visual frames must never mutate simulation state.
- Recommended help/font direction: localization-backed help keys and a centralized delayed tooltip manager; bold only text that actually has contextual help; independent UI and floating-text font settings; scan bundled `fonts/` plus platform font directories in the Electron main process and expose a safe font catalogue to the renderer.
- No source code changed in this review. No local tests/builds were run. Latest CI run at review time: [44770176048](https://github.com/Sakurefa/test-game/actions/runs/44770176048), completed successfully for commit `e97912c5ae19e7eab01491639317df6d8675e315`.
- No Windows desktop test performed.
- Next implementation phase should be staged: (A) schema/migration and campaign clock/event scheduler with pause/speed controls; (B) deterministic named RNG streams and calculation trace records; (C) 2D renderer shell and first actual star-map/market chart/colony scene; (D) tooltip/help and font catalogue/settings. Do not implement all four as one large change. First agree the base time rate and system cadence table before enabling continuous simulation.


### 2026-11-21 — broadened foundation scope and contextual-help requirements

- User refined the contextual-help contract: help text must explain both the fictional world and the actual game mechanics, not merely describe an abstract principle.
- Standard help content should contain two or three semantic sections/paragraphs:
  1. **World and principle:** immersive in-world explanation of what the system represents and why it behaves that way.
  2. **Player-facing mechanics:** concrete gameplay rules, relevant values, modifiers, thresholds and calculation effects; formula IDs must resolve to the actual implementation.
  3. **Player guidance (when useful):** actionable navigation such as where to inspect, configure or influence the mechanic in the UI.
- Tooltip content should remain localization-backed and data-driven. The renderer should support optional sections rather than forcing every tooltip to contain three paragraphs. Bold styling is reserved for labels that genuinely have contextual help.
- User explicitly deferred tactical combat implementation. Do not build battle simulation, ship combat AI, battle scene or battle-specific time loop during the current foundation expansion. Preserve a clean future seam for an independently stepped real-time battle runtime, but do not let it dictate the current campaign scheduler.
- User expanded the architecture goal: the foundation must support future ideas beyond the currently listed time, RNG, 2D, tooltip and font work. This includes audio, visual/art assets, richer 2D scenes, animation, particles, and more modular subsystem composition.
- Adopt the following cross-cutting architecture principles before expanding feature code:
  - **Authoritative simulation boundary:** engine state and deterministic simulation remain independent of Electron, DOM, rendering, audio playback and wall-clock frame timing.
  - **Subsystem contracts and lifecycle:** systems register through explicit metadata/dependencies/cadence/phase contracts; initialization, update, snapshot, save/load and disposal responsibilities are explicit. Avoid one giant central switch statement.
  - **Event and command boundaries:** player/AI intent enters through validated commands; simulation emits typed domain events; presentation consumes immutable snapshots/events and cannot mutate authoritative state.
  - **Capability-based services:** time, named random streams, formulas/audit traces, localization/help, assets, audio, fonts, input and rendering are exposed through narrow services/adapters so new implementations can be added without coupling gameplay code to a particular library.
  - **Asset pipeline:** stable asset IDs and metadata, centralized resolution/loading/caching/lifecycle, separate image/texture, audio, font and animation/sprite resources, with future Mod asset namespaces and validation. No executable Mod scripts or code hooks; asset support must not weaken the data-only Mod security contract.
  - **Presentation composition:** DOM remains suitable for menus, panels and accessible controls; a scene/rendering adapter owns 2D world views, layers, cameras, animation and particles. Prefer a renderer-neutral scene contract so PixiJS or another backend can be evaluated/swapped without changing simulation rules.
  - **Observability and determinism:** calculation traces, structured logs, domain events and replay-friendly state are first-class services. Visibility/debug toggles must never alter simulation results or random consumption.
  - **Extensibility without premature complexity:** define stable interfaces and test them with small real implementations; do not install multiple rendering/audio frameworks or build speculative generic plugin machinery without a concrete use case.
- Revised work sequence:
  A. **Foundation contracts and campaign time:** inspect current interfaces, define system lifecycle/dependency/cadence contracts, implement main-process-owned pause/1x–4x campaign clock and daily/weekly scheduler, preserve old-save migration and deterministic catch-up.
  B. **Deterministic calculation services:** stable named random streams, formula registry/versioning, structured calculation traces and bounded audit history.
  C. **Presentation and asset foundation:** renderer-neutral scene/asset contracts, 2D renderer adapter evaluation, initial star-map/market-history/colony scene integration, plus audio resource/playback interface (without requiring a full soundtrack or large asset set).
  D. **Help, fonts and UI services:** semantic 2–3-part help content, delayed tooltip manager, separate interface/floating-text fonts and safe font discovery.
  E. **Integration hardening:** save migration, Mod asset validation boundaries, localization coverage, performance tests, documentation and Windows package smoke-test instructions.
- Combat remains a later independent project phase. Future battle runtime must have its own fixed-step clock and exchange validated campaign commands/events; it is not part of this current foundation sequence.
- Repository state at start of this session: default branch latest commit f79049d1d311737c1ae33344b9838c487247f1a6. Re-read root AGENTS.md and the complete work log. Inspected package.json, engine/clock.cjs, engine/simulation.cjs, engine/random.cjs, electron/main.cjs (partial fetch), src/styles.css and docs/ENGINE_ARCHITECTURE.md. The source still has a day-step-only simulation, one global PRNG stream and DOM/CSS card presentation. setting/graphics.ini was not found at that path; locate the actual settings schema path before changing it.
- GitHub Actions lookup for commit f79049d1d311737c1ae33344b9838c487247f1a6 returned no PR-triggered workflow runs. The previous log records successful CI run 44770176048 for e97912c5ae19e7eab01491639317df6d8675e315; that is historical evidence, not verification of the current commit.
- No source code was changed in this session. No local tests/builds were run. No Windows desktop test was performed.
- Next concrete task: locate current settings/config schema and inspect complete main/preload/renderer interfaces, then implement Phase A through small testable commits. Before introducing any renderer/audio dependencies, establish the subsystem and asset service contracts. Update this log after each work session.


### 2026-11-21 — Phase A: continuous campaign time and simulation-system registry

- Re-read the full root `AGENTS.md` and complete `ASTRA_WORKLOG.md` before implementation. Checked the default branch head and latest relevant Actions runs. Starting head was `a900b7b3df9c5e71f8a4ac89deffde2ee33bdf8e`; prior CI run `44777996978` was green for that base.
- Added `engine/system-registry.cjs`: stable system IDs, daily/weekly/manual cadence, deterministic priority, dependency validation/topological ordering, initialize/update/save/restore/dispose hooks, explicit manual trigger, synchronous deterministic update requirement and per-system last-run-day protection.
- Added `engine/campaign-time.cjs`: monotonic main-process time controller, pause and 1x–4x speeds, independently configurable base game-day duration and deterministic injectable clock for tests.
- Extended `engine/clock.cjs` to preserve fractional game-day progress and convert elapsed campaign time into whole-day boundary crossings.
- Refactored `engine/simulation.cjs` around registered systems. Market/security quotes and war chronology run daily; colony industrial production runs every seven elapsed days (day 7, 14, 21…). Weekly production executes before same-day market repricing. Catch-up processes every crossed daily boundary; the scheduler records execution markers to avoid duplicate updates.
- Bumped world save schema from 1 to 2. Added `migrateWorldState` to preserve the old date/day while initializing fractional time and scheduler state. Storage reads schema-1/2 worlds and writes schema-2 only.
- Added runtime INI setting group `simulation` with `base_day_seconds=60` (allowed 10–3600 seconds). The default is one game day per 60 real seconds at 1x; speed multiplier is independent. The file is generated by storage initialization as `setting/simulation.ini`; it is not a tracked source file.
- Electron main process owns the authoritative timer and IPC time controls. New worlds and loaded saves begin paused. Saving takes a consistent world snapshot while paused, then resumes the previous speed. Renderer polls snapshots but updates the clock display without full-screen re-rendering between date boundaries.
- Replaced the visible “推进一天” action with pause and 1x/2x/3x/4x controls; added base-day duration selection under Settings. The legacy one-day IPC method remains only as a compatibility/debug entry point.
- Added tests in `tests/campaign-time.test.cjs`, `tests/system-registry.test.cjs`, and expanded engine/storage tests for cadence ordering, fractional catch-up, manual systems, save migration and settings validation.
- First CI attempt `44782725042` found an ordering bug: the registry processed all currently-ready systems as a batch, allowing an independent lower-priority system to run before a newly-unblocked higher-priority system. Fixed the topological ordering to select one highest-priority ready system at a time. Source fix commit: `0e412336c4f2f1be0ad7f4620a2fd88b630d2247`.
- Verified by Windows GitHub Actions run [44782960920](https://github.com/Sakurefa/test-game/actions/runs/44782960920): syntax checks passed; all 41 tests passed (0 failed); Vite renderer build passed. Workflow generated and committed `dist/index.html` and hashed JS/CSS files as `0915f4de98084391e4d35576e4fcf1c3c7ed7c59`.
- Exact source/docs/tests changed: `engine/system-registry.cjs`, `engine/campaign-time.cjs`, `engine/clock.cjs`, `engine/index.cjs`, `engine/simulation.cjs`, `electron/storage.cjs`, `electron/main.cjs`, `electron/preload.cjs`, `src/main.js`, `src/world.js`, new `src/time-controls.css`, `tests/engine.test.cjs`, `tests/storage.test.cjs`, new `tests/campaign-time.test.cjs`, new `tests/system-registry.test.cjs`, `package.json`, `docs/ENGINE_ARCHITECTURE.md`, `docs/PLAYTEST_GUIDE.md`, and `README.md`; CI generated the four dist files listed above.
- The settings-path note in earlier architecture review was corrected: graphics settings are dynamically generated in runtime `setting/graphics.ini`, and the new timing settings are generated in `setting/simulation.ini`.
- No full local repository test suite or local Vite build was run in this tool environment. The authoritative full suite/build result is the Windows Actions run above. A separate isolated local harness had previously passed 5/5 clock/controller/registry checks.
- No Windows desktop GUI launch was performed by the assistant. User-side test is now the next required verification: download the latest main ZIP, put the separately distributed launcher EXE beside the extracted repository files, start a new world, confirm it begins paused, test pause and 1x–4x, let one day elapse, verify daily market/war updates, let day 7 elapse for weekly production, save/load, and confirm a loaded world is paused with no duplicate weekly settlement.
- Known limitations: the current PRNG is still a single global stream; no calculation audit display, event/command bus, asset/audio manager, real 2D scene renderer, contextual tooltips or font scanning have been implemented yet. Tactical combat remains deferred.
- Next concrete step after the user's Windows smoke test: begin Phase B (named RNG streams plus versioned calculation formulas/audit traces), retaining the user’s rule that visual/debug toggles cannot change outcomes.
