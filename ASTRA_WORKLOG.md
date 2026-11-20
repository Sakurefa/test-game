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

- Latest source commit: `5a4d8103e673b589aeab5b7596bba0c8c99bf13b`.
- Latest main branch commit including generated renderer files: `f843b1f5e177d09ca7e48cf930201ed2a309bc88`.
- GitHub Actions run [44788224888](https://github.com/Sakurefa/test-game/actions/runs/44788224888) completed successfully for the UI synchronization fix:
  - Electron/engine syntax checks: passed.
  - Full automated suite: 45 passed, 0 failed (four new clock interpolation tests included).
  - Vite renderer build: passed.
  - Generated renderer files were committed by the workflow as `f843b1f5e177d09ca7e48cf930201ed2a309bc88` (`dist/index.html` and hashed JS/CSS assets).
- The previous continuous-time kernel verification remains [44782960920](https://github.com/Sakurefa/test-game/actions/runs/44782960920), with 41/41 tests passing.
- An initial CI run [44782725042](https://github.com/Sakurefa/test-game/actions/runs/44782725042) correctly exposed one simulation-system ordering assertion (40/41 passed). The topological ordering implementation was fixed in `0e41233`, and the complete suite then passed.
- The companion runtime workflow [44782725039](https://github.com/Sakurefa/test-game/actions/runs/44782725039) stopped at the same test failure before building a launcher. The subsequent fix changed only the engine registry; the existing separately distributed Electron launcher remains compatible because it loads `electron/main.cjs`, preload and `dist/` from the adjacent repository directory. No new EXE was produced in this session.
- The Mod tree contains only INI package files; there are no tracked JSON files under `mods/`.
- Core uses `manifest.ini`, `registry/definitions.ini`, `content/*.ini` and `localization/zh-CN.ini`.
- The example Mod also uses INI manifest, registry, content and localization files. Its event text is referenced by localization keys.
- Mod loader accepts only declared `.ini` files and parses them in strict mode, rejecting inline JSON arrays/objects. The generic INI parser still supports inline JSON values by default for unrelated existing game settings such as `setting/mods.ini`; this compatibility is intentional and must not be removed without migrating those settings too.
- `MOD_API.md`, `README.md`, `mods/README.md` and `docs/ENGINE_ARCHITECTURE.md` document the INI-only contract.
- Root `AGENTS.md` and this work log establish the mandatory start/end session protocol.
- **No Windows desktop test has been performed for this exact revision.** The user previously launched an earlier build and observed a day advance, but has not validated the correctness of the simulation numbers.

## Latest verified repository update — 2026-11-21

- Latest source commit for incremental view refresh, weekly progress and live week-day metadata: `c8bbe13d19a3bd7b6f3caed90deac8d625d2f05b`.
- Latest `main` commit including CI-generated renderer output: `73a2387a14f8f7946c9cf4ef6400513646fddc14`.
- GitHub Actions run [44791557695](https://github.com/Sakurefa/test-game/actions/runs/44791557695) completed successfully for the final renderer source, including the live week-day metadata correction:
  - Electron/engine syntax checks passed.
  - Full automated suite: 52 passed, 0 failed.
  - Vite renderer build passed.
  - CI generated updated `dist/index.html` and hashed JS/CSS assets in `f096593`.
- The user confirmed the previous clock interpolation is now smooth. The new incremental rendering and weekly progress changes have CI coverage, but have not yet received a Windows desktop GUI test.

## Latest verified repository update — Phase B calculation foundation — 2026-11-21

- Phase B source commit: `e494e401bbbea8dff3d08b009480439a85e46823`.
- Latest `main` head after verification: `e494e401bbbea8dff3d08b009480439a85e46823`.
- GitHub Actions run [44796660751](https://github.com/Sakurefa/test-game/actions/runs/44796660751) completed successfully:
  - Electron/engine syntax checks passed.
  - Full automated suite: 57 passed, 0 failed.
  - Vite renderer production build passed.
- User confirmed the incremental view refresh, preserved scroll position and seven-segment weekly progress behavior on Windows. This is user-side confirmation of the prior UI revision, not a GUI test of the new Phase B engine changes.

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


### 2026-11-21 — fix continuous clock display synchronization and renderer overhead

- User reported a concrete runtime defect: the day progress percentage only changed after clicking a speed button; world panels also appeared stale, and the game felt sluggish.
- Read the complete root `AGENTS.md` and `ASTRA_WORKLOG.md`, checked current `main` and the latest successful CI run before investigating. Starting main head: `de2bfeefba5981ec3ae9f2b8fd48268e590bcb18`.
- Root cause: the renderer's polling code read `state.world.clock.day`, but the actual snapshot shape is `state.world.world.clock.day`. This threw before it could update the stored snapshot or display, so the periodic refresh silently aborted in its catch handler. Speed-button actions appeared to fix the display because they returned a fresh full snapshot and explicitly rerendered the screen.
- Second issue: the old 500 ms poll invoked `world:time-status`, which constructed and serialized a full world snapshot even though the UI only needed the clock fraction. This caused avoidable IPC and repeated catalog/snapshot work.
- Added `world:clock-status` in Electron main and a narrow preload API `getClockStatus()`; it returns only the campaign clock, time-control state, save ID and dirty marker. Full `getStatus()` snapshots are now requested only when the authoritative day count changes and daily simulation systems have committed.
- Added `src/time-display.mjs` with a pure interpolation helper. Renderer uses `requestAnimationFrame` to smoothly animate the progress percentage/bar between authoritative clock samples. It clamps the predicted display at 99.9% until the main process confirms the day boundary, so visual interpolation cannot invent a calendar day or mutate simulation state.
- Split clock DOM updates into two paths: metadata (date, day/week, speed buttons and save status) updates only when a clock sample changes; animation frames update only the progress percentage, progress-bar width and its accessible value. Clock DOM elements are cached after each world render.
- Reduced polling to a lightweight 250 ms clock-status request. Complete world panels refresh only when the day changes, which is when current market and war systems actually update. This is deliberate: the displayed day progress animates continuously, but daily market values do not change continuously between scheduled daily settlements.
- Added `tests/time-display.test.mjs`: verifies interpolation at 1x, scaling at 4x, pause behavior, end-of-day clamping and invalid input rejection. Updated the playtest guide and architecture doc to explain the smooth display and day-boundary refresh behavior.
- Exact source changes: `src/main.js`, `src/world.js`, `src/time-controls.css`, new `src/time-display.mjs`, `electron/main.cjs`, `electron/preload.cjs`, new `tests/time-display.test.mjs`, `docs/PLAYTEST_GUIDE.md`, and `docs/ENGINE_ARCHITECTURE.md`. CI generated the corresponding updated files in `dist/`.
- Source fix commit: `5a4d8103e673b589aeab5b7596bba0c8c99bf13b`. Windows GitHub Actions run [44788224888](https://github.com/Sakurefa/test-game/actions/runs/44788224888) completed successfully: syntax checks passed, all 45 tests passed (0 failed), and Vite renderer build passed. Generated renderer output was committed as `f843b1f5e177d09ca7e48cf930201ed2a309bc88`.
- No local full test suite/build was run in this environment. No Windows desktop GUI launch was performed by the assistant. The issue requires user-side confirmation on the newly downloaded main ZIP; the separate EXE does not need updating because its bootstrap loads the adjacent repository's current `electron/main.cjs`, preload and `dist/`.
- Next verification: user should download the latest main ZIP and confirm (1) percentage/progress bar move smoothly without clicking, (2) date and all relevant panels refresh on day rollover, (3) pause freezes the progress, (4) no obvious stutter remains at 1x–4x. If confirmed, continue with Phase B named random streams and formula/audit traces.

### 2026-11-21 — incremental world-view refresh and weekly campaign progress

- Re-read the complete root `AGENTS.md` and `ASTRA_WORKLOG.md`, inspected the current `main` head and latest Actions status before editing. Starting main head: `21ffb864d17db81abc78c135d7e661aeeeb3e7a5`.
- User reported that each date change caused the overview's recent-event list to rebuild and the world view's scroll position to jump to the top. The root cause was confirmed in `src/main.js`: the date-boundary polling path fetched a full snapshot and called `renderActiveWorld()`, which replaced `#app` and therefore destroyed the mounted `.world-content` scroll container.
- Added a cadence-aware view-region policy in `src/world-refresh.mjs`: overview event history, market quotes and war chronology refresh daily; colony production refreshes only when a seven-day boundary is crossed. Added policy tests, including multi-day catch-up.
- Added stable region IDs and `renderWorldRegion()` to `src/world.js`. On an authoritative day change, `src/main.js` now replaces only the due region and keeps the existing `.world-content` scroll owner mounted, explicitly restoring its previous `scrollTop`. The renderer no longer rebuilds the entire world screen for automatic date-boundary updates.
- Switched the campaign progress indicator from a single-day bar to a seven-segment weekly bar. `src/time-display.mjs` now derives week progress from the authoritative day plus interpolated day fraction; crossing a confirmed seven-day boundary resets the displayed week. This visual calculation does not control or mutate simulation time. Added coverage for daily segments, week rollover, interpolation, clamping and invalid inputs.
- Updated `docs/ENGINE_ARCHITECTURE.md` and `docs/PLAYTEST_GUIDE.md` with region refresh contracts, expected scroll behavior and seven-segment week progress.
- Exact source/test/docs changes: `src/main.js`, `src/world.js`, new `src/world-refresh.mjs`, `src/time-display.mjs`, `src/time-controls.css`, `tests/time-display.test.mjs`, new `tests/world-refresh.test.mjs`, `docs/ENGINE_ARCHITECTURE.md` and `docs/PLAYTEST_GUIDE.md`. CI generated `dist/index.html` plus the updated hashed JS/CSS outputs.
- Source commit: `a667df97e7415b964c4a7d8a9cf73c2a49028dea`. GitHub Actions run [44791212863](https://github.com/Sakurefa/test-game/actions/runs/44791212863) passed syntax checks, all 52 automated tests (0 failed) and the Vite renderer build. CI generated renderer commit: `f09659303c76c29fb70bd16aa8628431952e56f7`.
- Important remaining distinction: daily updates still fetch/serialize a full world snapshot over IPC; only DOM rendering is now region-scoped. The current prototype world is small, but a future domain-event/per-domain projection phase should narrow that payload so data transfer also scales with changed systems. Explicit tab navigation and some user-triggered actions still use the full screen renderer.
- No local full suite/build or assistant-run Windows desktop GUI test was performed. The new behavior requires user-side verification on Windows, especially scrolling within 最近动态 while days advance, weekly bar segmentation/reset, and daily-vs-weekly panel refresh cadence. The separately distributed launcher EXE does not need replacement because it loads the adjacent repository's current source/runtime files.
- Next: obtain the user's Windows validation, then proceed with named RNG streams and formula/audit services. Preserve the separation between simulation cadence, IPC update payloads and DOM view refreshes.


### Follow-up verification — live weekly day label

- A final source review found that the initial world render included the current weekday label, but the existing clock metadata synchronizer overwrote it with the older day/week-only text on the next clock sample.
- Updated `src/main.js` so live clock metadata consistently displays total elapsed day, week number and day-within-week.
- Follow-up source commit: `c8bbe13d19a3bd7b6f3caed90deac8d625d2f05b`. Windows GitHub Actions run [44791557695](https://github.com/Sakurefa/test-game/actions/runs/44791557695) completed successfully: syntax checks passed, all 52 tests passed (0 failed), and Vite production build passed. Generated renderer output commit: `73a2387a14f8f7946c9cf4ef6400513646fddc14`.
- No Windows desktop GUI test has yet been performed for this revision; user-side verification remains required.


### 2026-11-21 — Phase B: named random streams and formula audit foundation

- Re-read the complete root `AGENTS.md` and complete `ASTRA_WORKLOG.md`; checked current `main` and latest Actions run before editing. Starting head: `eba38a456c1eabb8c01999350605d1a88e3d1166`; its log-only CI run 44791824471 was green.
- User confirmed the previous continuous clock, incremental view refresh, scroll retention and weekly progress bar work correctly on Windows. Proceeded to the next planned foundation phase.
- Replaced the single shared world PRNG state with `NamedRandomStreams` in `engine/random.cjs`. Each stable stream ID derives an independent seed from the saved world seed; stream states are serialized in stable key order and restored exactly. Market noise now uses a separate stream per market/instrument (`economy.market.<market-id>.<instrument-id>`), so adding draws in another instrument does not shift this instrument's sequence.
- Added `engine/formulas.cjs` with a versioned calculation registry and bounded audit capture. Implemented `economy.commodity-price` v1 and `economy.security-price` v1, preserving the existing pricing equations and rounding behavior. Each execution records day, formula ID/version, inputs, modifiers, intermediate steps, actual random draws and result.
- Calculation audit capture is unconditional in the engine and the most recent 200 records are persisted in the world save. Reading audit records is observational and does not touch PRNG state. A future visibility toggle must remain a renderer-only filter over recorded data; no display toggle currently enters the simulation engine.
- Bumped world save schema from 2 to 3. Schema 1 and 2 saves migrate their date, day fraction and scheduler markers; their original world seed is retained while the legacy single shared RNG state is intentionally replaced with fresh independently derived named streams. This means future random outcomes after migration differ from the legacy shared-stream sequence, but new schema-3 saves resume deterministically. No existing colony, market, fleet, war or event state is intentionally reset.
- Updated storage to accept legacy schema 1/2 reads and write schema 3. Added tests for named-stream isolation, snapshot/restore, stable serialization, invalid IDs/seeds, formula trace contents, audit history bounds, observational audit reads, schema migration and schema-3 storage.
- Exact files changed: `engine/random.cjs`, new `engine/formulas.cjs`, `engine/simulation.cjs`, `engine/index.cjs`, `electron/storage.cjs`, `tests/engine.test.cjs`, `tests/storage.test.cjs`, and `docs/ENGINE_ARCHITECTURE.md`.
- Source commit: `e494e401bbbea8dff3d08b009480439a85e46823`. GitHub Actions run [44796660751](https://github.com/Sakurefa/test-game/actions/runs/44796660751) passed syntax checks, all 57 automated tests (0 failed), and the Vite production build. No generated renderer diff was required for this engine-only phase.
- No local full test suite/build was run. The CI run is the verified automated result. No assistant-run Windows GUI test was performed for Phase B; the user-side Windows confirmation above applies to the previous UI revision only.
- Known next tasks: add a read-only renderer-facing calculation inspector/visibility control that only filters existing audit records; extend formula registration as production, colony, logistics and finance systems are implemented; add deterministic expected-value tests and domain-level simulation correctness audits. Do not expose a visibility flag to engine formulas or RNG services. Preserve Mod INI-only/data-only constraints. Tactical combat remains deferred.
