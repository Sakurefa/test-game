# World Simulation Architecture

The project is a multi-system frontier simulation. A commodity exchange is one subsystem of a shared world, not the central game loop.

## Subsystem boundaries

- **Universe:** star systems, locations, travel lanes, ownership and spatial relationships.
- **Colonies:** population, stability, inventories, facilities and development.
- **Production:** data-defined recipes, inputs, outputs, workforce and operating efficiency.
- **Economy:** commodities, companies, markets, securities and later player orders/accounts.
- **Military:** ship classes, fleets, readiness, orders, wars, fronts and later real-time battles.
- **Simulation kernel:** continuous campaign clock, seeded random state, ordered daily/weekly systems, event history and save validation.
- **Presentation:** renderer only displays snapshots and sends player commands. It does not own authoritative simulation state.

## Runtime contract

The simulation engine is plain Node.js CommonJS under `engine/`. It does not import Electron, browser APIs, or renderer code. The Electron main process owns the active world and exposes a narrow IPC bridge. The renderer receives snapshots and submits commands; it never edits the authoritative state directly.

The Electron main process owns the active world and its campaign-time controller. It samples a monotonic clock, converts elapsed real time through the configured base-day duration and selected 1x–4x speed, and passes fractional game days to the engine. The renderer issues time-control commands and polls a small clock-only IPC payload. It interpolates the visible day-progress bar locally with requestAnimationFrame; full world snapshots are requested only when the authoritative main-process clock crosses a day boundary. UI animation and polling never drive simulation state.

The simulation registry defines stable system IDs, cadence, priority, dependencies and optional initialize/update/save/restore/dispose lifecycle hooks. Dependencies are topologically ordered, updates are synchronous and deterministic, and each system records its last execution day in the world save. A system cannot run twice on the same day after a save/load or repeated scheduler call.

The current campaign schedule is:

1. **Every game day:** advance the calendar; update commodity and security quotes; advance active-war chronology; append a bounded daily report.
2. **Every seventh elapsed game day (day 7, 14, 21…):** run colony industries once before that day’s market repricing, consuming inputs before adding outputs.
3. **Between date boundaries:** retain fractional day progress in the active world state; explicit world saves persist that fraction without triggering daily systems.

The initial base rate is one game day per 60 real seconds at 1x. The 1x–4x multiplier is independent of this rate and can be tuned through `setting/simulation.ini` (`base_day_seconds`). New games and loaded games start paused. The engine clock itself does not depend on wall-clock timestamps.

A saved game records its world schema version, content fingerprint, calendar date/day/fraction, scheduler markers, random state and dynamic entities. Version-1 world saves migrate by preserving date/day and initializing the fractional time and scheduler state. Loading against a different content fingerprint is still rejected explicitly rather than silently binding saved entities to changed Mod definitions.
 
## Data-only Mod contract

A Mod package is INI-only. Its manifest, registry declarations, content definitions and localization files all use INI. JSON files and inline JSON arrays/objects are rejected by the loader. The root npm `package.json` is project build metadata and is not part of the Mod format.

Core definitions are divided into:
- `universe.ini`: universe, systems, locations, colonies and trade routes.
- `economy.ini`: commodities, production recipes, companies, securities and markets.
- `factions.ini`: faction definitions.
- `military.ini`: ship classes, fleet compositions and wars.
- `events.ini`: declarative event definitions.
- `registry/definitions.ini`: stable ID/type declarations.
- `localization/zh-CN.ini`: Chinese player-facing strings referenced by stable keys.

Content sections use `[type.stable-id]`; the singleton universe uses `[universe]`. Repeated nested records use numbered keys, and simple lists use semicolon-separated values. The loader normalizes these INI sections into validated engine objects. Player-visible names, descriptions, government labels and commodity units are stored only in locale INI files. The catalog rejects missing localization references, duplicate IDs and unresolved cross-references before a world can start.

Mods are data-only: they cannot execute scripts, ship native code or provide runtime hooks.

## Determinism

A world stores both the original seed and the current PRNG state. Advancing the same catalog and state produces the same results. Random state is part of the save format; loading a save does not restart its random sequence. Scheduler execution markers and campaign-day fractions are saved too, so loading cannot accidentally duplicate a daily or weekly update.

The current engine still uses one seeded random stream. Stable named streams and formula audit records are the next simulation-foundation phase; they are not yet implemented.
 
## Current prototype boundary

The campaign world now runs continuously under pause and 1x–4x controls. Market repricing and war chronology are daily systems; colony production is weekly. Fleets, ship classes and war state remain static registered data. Tactical combat, fleet movement, logistics between colonies, diplomacy and player financial orders are not implemented. Tactical combat is explicitly deferred and will require its own independent real-time simulation rather than being added to the campaign scheduler.
 
## World model and future subsystem seams

### Spatial and political layer

The universe is a graph, not a flat list. Star systems declare coordinates and neighboring systems; locations belong to one system; colonies attach to locations; factions can control systems, locations and colonies. Trade routes are explicit edges with travel time, risk and capacity. The current scenario validates these relationships but does not yet simulate ships or cargo moving along them.

Future ownership changes should be represented as world-state commands and logged events, rather than editing Mod definitions. Mod data defines the initial world and available content; player and AI actions change the running world.

### Colony and production layer

A colony owns its population, stability, stockpiles and industry instances. An industry selects a data-defined recipe and level. A recipe declares commodity inputs, outputs and optional workforce requirements. Production consumes inputs before adding outputs, preventing a single batch from using its own output as an input.

The current prototype models industry throughput from level and stability and consumes available input stock. Population, workforce allocation, facility upkeep, pollution, service demand, construction queues and local logistics are not simulated yet. These are separate features that can be introduced without changing the identity of a colony or commodity.

### Commerce and finance layer

Commodities are physical goods; securities are financial instruments issued by companies. A market belongs to a colony and quotes only the instruments it lists. Current commodity prices react to local inventories, while company securities receive a small seeded operational signal and market noise.

The next financial foundation should be an append-only transaction ledger: cash movements, trades, fees, debt, interest, dividends and company operating results should be traceable entries. Portfolio values should be derived from ledger positions and current quotes, not maintained as unrelated counters. The current player account is only a starting-state placeholder; no player trade or financial contract is enabled yet.

### Strategic military and tactical battles

The strategic layer owns factions, fleets, locations, readiness, morale, war declarations, fronts, objectives, supply and campaign outcomes. A fleet is a strategic entity even when it is assigned to a tactical encounter.

A tactical battle should be its own bounded simulation instance with participating fleets, ship instances, formations, orders, combat state and outcome. It should not be implemented by advancing the entire universe once per animation frame. Campaign time and battle time are separate domains: a battle uses a fixed simulation timestep, while the strategic world advances only according to an explicit campaign-time policy. Battle results return to the world through a validated outcome transaction.

This separation is essential for pause, speed controls, AI battles, save/load and future multiplayer possibilities. No tactical damage model or command model is assumed in the current prototype.

## Simulation ordering and system contracts

New simulation systems should be registered with stable IDs, explicit cadence, deterministic priority and declared dependencies. A system may optionally provide initialization, update, save, restore and disposal hooks. Systems must not depend on renderer timing, Electron APIs, audio playback or direct DOM state. Cross-system changes should be expressed through well-defined inputs and outputs; the future event/command layer will formalize this boundary.

The current registry supports daily, weekly and manual cadences. Weekly scheduling is anchored to the campaign start: it runs after every seven elapsed days (day 7, 14, 21…). The scheduler records the last day each system ran, and its registry order ensures weekly production executes before market repricing on a shared boundary day.
 
## Development roadmap

1. **World kernel (current):** validated universe graph, locations, factions, colonies, recipes, commodities, markets, fleet definitions, seeded time and save/load.
2. **Colony simulation:** workforce, population needs, facility upkeep, storage limits, stability modifiers, construction and colony development.
3. **Logistics:** ships and convoys travel through route graphs, use travel time and capacity, face route risk, and move physical stock between locations.
4. **Economic agency:** company accounting, operating costs/revenue, player orders, ownership, fees, debt and financial reporting.
5. **Strategic warfare:** fleet movement and orders, supply, fronts, objectives, faction AI, war weariness and territorial change.
6. **Tactical combat:** separate real-time battle instances, ship behavior and orders, damage, retreat, casualties and campaign outcome application.
7. **Living world:** event scheduling, diplomacy, policies, missions, additional content and community scenarios.

Each phase should be playable and testable before the next adds complexity. The goal is not to finish seven disconnected subsystems; it is to make each one read and change the same persistent world.


## Extensible service and presentation direction

The authoritative engine remains plain Node.js and must not import Electron or browser code. Future capabilities should enter through narrow adapters rather than being embedded into simulation rules:

- **Commands and domain events:** validated player/AI commands enter the world; typed events describe completed world changes. UI, logs, audio and visual effects consume those events without mutating simulation state.
- **Assets:** stable asset IDs resolve through a central catalogue/loader with validation, caching and lifecycle management. Image/texture, sprite/animation, particle, audio and font resources share identity and metadata conventions but use suitable resource-specific loaders.
- **Presentation:** DOM remains responsible for menus, settings and accessible controls. A renderer-neutral scene interface will host the star map, colonies and other 2D spaces. A backend such as PixiJS may implement that interface, but engine rules must not depend on the selected renderer.
- **Audio:** sound playback and mixing belong to a presentation service. Simulation events may request sound cues by ID; the engine must remain testable without an audio device.
- **Mod safety:** Mods remain data-only INI packages. Future image/audio/font assets may be declared by data manifests and validated against safe path, size, type and namespace rules. Assets do not grant script execution, runtime hooks or native-code access.

These are architectural seams, not claims that the asset manager, event bus, renderer or audio engine already exist. They should be introduced in small independently tested increments. Tactical combat is a later isolated subsystem and is not part of this foundation phase.
