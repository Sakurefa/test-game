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

A saved game records its world schema version, content fingerprint, calendar date/day/fraction, scheduler markers, random state, dynamic entities, typed domain-event history and recent command receipts. Legacy world schemas 1–5 migrate to schema 6 while preserving campaign time, existing entities, and the player's prior cash/holdings. The migration initializes the finance ledger and command receipt fields that did not exist in older formats. Loading against a different content fingerprint is still rejected explicitly rather than silently binding saved entities to changed Mod definitions.
 
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

## Determinism and domain events

A world stores its original seed and each named PRNG stream state. Stream IDs are stable simulation identifiers, and independent market-instrument streams prevent unrelated systems from perturbing one another. Formula calculations are synchronous and versioned; each execution records inputs, modifiers, intermediate steps, actual random draws and its result. Audit history is bounded and saved, and reading it does not consume randomness.

The engine appends typed domain events with monotonic sequence IDs, campaign day/date, scope, subject and JSON-safe payload. The retained history is bounded independently from the localized narrative event feed. Production, market settlement and active-war chronology emit events with stable day/entity idempotency keys. A repeated emission with the same key and same fact returns the existing record; reusing a key for a conflicting fact is rejected. The history validates key uniqueness and sequence continuity, and event records survive save/load. Legacy schema migrations begin a fresh typed history because earlier saves did not contain these events.

Save validation rejects non-finite or negative stockpiles, invalid stability/population values, non-positive or non-finite quotes, malformed account state, unbalanced ledger transactions, account balances that disagree with ledger replay, duplicate transaction command IDs and inconsistent domain-event history. This catches corrupted or impossible economic state at the world boundary instead of allowing invalid values to propagate through later settlements.

## Validated commands, event delivery and main-process gateway

The engine provides a reusable command dispatcher and world-command runtime. A command envelope contains a unique `commandId`, a stable command `type` and a JSON-safe `payload`. Each registered handler supplies synchronous validation and execution, with an optional authorization check. Validation and authorization receive detached, deeply frozen world snapshots; execution receives an isolated mutable world draft. An optional world validator runs before the draft can be committed. If validation, authorization, the handler, post-transition validation or event persistence fails, the original world object remains unchanged.

Successful commands append a bounded receipt to the world. The receipt stores the command ID, command type, canonical payload signature, campaign day and result. Replaying an identical command ID and payload returns the original result without applying the transition or emitting its events again; replays must still pass authorization. Reusing an ID for different intent is rejected. The saved receipt window retains the latest 256 commands. This is a bounded retry/idempotency boundary, not a substitute for durable transaction IDs in a financial ledger.

Handlers return event descriptors rather than publishing directly. The world-command runtime commits the state draft and receipt, appends those events to the same persisted domain-event history, and then publishes newly committed records through an optional event bus. Subscribers receive detached, deeply frozen event snapshots. Subscriber failures are isolated and exposed as delivery diagnostics.

The Electron main process now owns a trusted world-command gateway and exposes a narrow `world.dispatchCommand()` preload method. The renderer submits only a command envelope; the main process derives actor identity from the active world's player faction and never accepts an actor/permission object from the renderer. The gateway currently registers only `finance.transfer`. It validates source ownership, open-account status, currency equality, exact minor-unit amounts and available funds. This is a gateway foundation, not yet a complete player trade UI or an order-book implementation. Future commands should be explicitly registered and authorized rather than accepting arbitrary handler names from IPC.

## Financial account and ledger contract

World schema 6 replaces the prototype `player.account.cash` value with a canonical `finance` ledger. Accounts have stable IDs, owner identity, currency, integer balance in minor units, overdraft policy, status and positions. Runtime services can register new accounts and currency definitions without inventing starting balances; newly registered accounts begin at zero and must be funded by a balanced transaction. The player account is `player-main`; the system treasury is the balancing counter-account used for initial capital and later external settlement flows.

Every ledger transaction has a monotonically increasing sequence, campaign day/date, stable transaction type, optional command ID/reference and two or more account entries. Entries are signed integer minor-unit deltas. Each transaction must balance to zero per currency, may reference each account only once, and must not violate an account's overdraft policy. Account balances are materialized projections which validation recomputes by replaying the append-only ledger; they are not independent sources of truth. Duplicate command IDs, tampered balances and unbalanced historical transactions are rejected. The ledger currently has a hard 50,000-transaction capacity and refuses new appends rather than silently deleting accounting history.

The first currency is CR with two decimal minor units. Commands exchange integer minor units rather than floating-point currency values, avoiding binary floating-point drift in balances. Schema 1–5 migrations convert the previous player cash value to CR minor units and preserve the previous holdings object as the player's initial positions. The initial capital is represented as a balanced opening transaction against the system treasury.

The engine and main-process gateway are now connected, but no market buy/sell order, share ownership transfer, loan, dividend, company operating-cost or logistics payment command is registered yet. The ledger is the reusable accounting seam those systems will use; its presence does not imply those game mechanics are complete.

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

An append-only balanced transaction ledger now records account movements in integer CR minor units. Portfolio positions are retained on account records, while actual share trading and valuation still need their own order and settlement commands. Future fees, debt, interest, dividends and company operating results should post balanced ledger transactions rather than mutate account balances directly.

### Strategic military and tactical battles

The strategic layer owns factions, fleets, locations, readiness, morale, war declarations, fronts, objectives, supply and campaign outcomes. A fleet is a strategic entity even when it is assigned to a tactical encounter.

A tactical battle should be its own bounded simulation instance with participating fleets, ship instances, formations, orders, combat state and outcome. It should not be implemented by advancing the entire universe once per animation frame. Campaign time and battle time are separate domains: a battle uses a fixed simulation timestep, while the strategic world advances only according to an explicit campaign-time policy. Battle results return to the world through a validated outcome transaction.

This separation is essential for pause, speed controls, AI battles, save/load and future multiplayer possibilities. No tactical damage model or command model is assumed in the current prototype.

## Simulation ordering and system contracts

New simulation systems should be registered with stable IDs, explicit cadence, deterministic priority and declared dependencies. A system may optionally provide initialization, update, save, restore and disposal hooks. Systems must not depend on renderer timing, Electron APIs, audio playback or direct DOM state. Cross-system state changes remain inside authoritative system updates, while completed production, market settlement and active-war chronology emit typed domain events. Validated player/AI command dispatch is now available as an engine service. Future gameplay systems still need to register concrete commands and route player/AI intent through the world-command runtime; UI controls must not gain direct access to world objects.

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

Typed domain-event records, a subscription bus and validated world-command dispatch are now implemented as reusable engine services. These foundations are not yet wired into Electron presentation, and no asset manager, scene renderer or audio engine is claimed to exist. Tactical combat is a later isolated subsystem and is not part of this foundation phase.


## UI refresh and campaign-time visualization

The renderer distinguishes simulation cadence from presentation refresh cadence. The campaign clock is polled through a lightweight clock-only IPC response; its progress is interpolated locally for display and never advances authoritative simulation state. When the main process confirms a day boundary, the current renderer view refreshes only the region whose data is due:

- Overview: recent event log, daily.
- Markets: market quote section, daily.
- Military: war chronology section, daily.
- Colonies: production and stockpile section, on each seven-day production boundary.

The world content scroll container remains mounted while a region is replaced, preserving the user's reading position. A full world snapshot is still transferred at committed day boundaries in this prototype; the next evolution should replace that broad payload with typed domain events or versioned per-domain projections as the number of active systems grows. UI refresh policy must remain downstream of simulation results and must never influence system cadence, random draws or settlement order.

The campaign progress bar represents the current seven-day week and uses seven visual segments. Continuous movement within each segment represents elapsed time in that day; crossing a segment boundary corresponds to a daily settlement, and the weekly boundary corresponds to colony production. The renderer clamps the display just before a boundary until the main process confirms the authoritative date change.


## Named randomness and calculation audit

World schema version 3 introduced named streams to replace the single shared PRNG state. World schema version 4 adds a bounded typed domain-event history while preserving the named stream state. World schema version 5 adds bounded command receipts for retry-safe command dispatch. World schema version 6 replaces the prototype cash field with a balanced integer-minor-unit financial ledger. Each stream seed is derived from the saved world seed and a stable lowercase stream ID; each stream advances independently and its state is saved under that ID. Current market noise uses one stream per market instrument (`economy.market.<market-id>.<instrument-id>`). Adding or consuming random values in another market or subsystem therefore cannot shift this instrument's sequence. Stream IDs are persistent simulation identifiers and must never be renamed casually.

Schema 1–5 saves migrate to schema 6 while preserving calendar, scheduler, entity and named-stream state where available. The player's previous cash and holdings are carried into the new player account. Schema 1/2 legacy shared PRNG positions cannot be mapped to independent streams without coupling them again, so those saves begin named streams from the original world seed; their future random outcomes intentionally differ from the old shared-stream sequence. Legacy saves begin with an empty typed domain-event history or command-receipt list only where those records did not exist. Schema 1–5 saves receive a balanced opening-capital ledger transaction. After migration, save/load remains deterministic.

The versioned calculation registry currently contains `economy.colony-production` v1, `economy.commodity-price` v2 and `economy.security-price` v2. Production traces expose stability efficiency, requested throughput, stock-limiting inputs, consumed quantities and produced quantities without consuming randomness. Commodity quotes remain inside a 0.1×–10× base-price corridor; securities are limited to ±12% daily movement and a 0.1×–10× initial-price corridor. These guardrails do not affect ordinary Core volatility values but prevent corrupted or extreme inputs from generating runaway quotes. The world save retains the latest 200 calculation records.

Calculation capture is unconditional in the simulation service. A future UI visibility switch must only decide whether the renderer displays already-recorded audit data; it must not be passed into formulas, scheduler systems or random-stream services. Thus enabling/disabling the inspector cannot alter random consumption, formula order or simulation results. Formula IDs in contextual help should resolve to these registry entries rather than duplicate formula text.


### Calculation audit inspector UI

The renderer exposes a read-only calculation inspector over the latest 30 persisted audit records. It displays formula ID/version, simulation day, input parameters, intermediate steps, modifiers, actual random draws and final result. The inspector reads the current world snapshot already held by the renderer; opening, closing, expanding or scrolling the panel makes no IPC request and sends no visibility flag to the simulation engine. When a new daily snapshot arrives, the panel refreshes its displayed records while preserving its own scroll position. This UI is diagnostic, not an interactive formula editor, and it does not yet imply that every simulation subsystem has registered a formula.


## Runtime diagnostics, autosaves and failure handling

- Runtime log records are one JSON object per physical line in `Logs/runtime.log`; startup records use `Logs/startup.log`. Each record carries an ISO timestamp, level, scope and message/payload. Runtime rotation keeps the active file plus four archives; the default cap is 100 MiB per file. Individual records may be up to 16 MiB. This intentionally favors useful diagnostics over tiny logs while keeping disk use bounded.
- Simulation day settlement writes a detailed record containing the day/date, production and market summaries, systems executed and formula calculation records. Typed domain events are written with their complete payload, not only event metadata.
- Account balances are authoritative runtime values. A transfer validates its own inputs and affected accounts, updates balances directly and returns a diagnostic transaction fact. Ordinary finance operations do not replay persisted transaction history to derive balances. Legacy transaction arrays may remain in older saves for compatibility, but they are not the runtime balance source.
- Full save validation runs when loading/migrating a world. The 100 ms campaign clock path and read-only snapshot path do not run full-world validation. A day boundary checks required inputs for that day's systems; it does not replay finance history.
- A day is settled on a detached candidate world. The live world is replaced only after all due systems finish successfully. If a required value/reference is missing or a system throws, the candidate is discarded.
- Each completed game day queues a daily autosave. Days divisible by seven also queue a weekly autosave. Daily and weekly autosaves have separate two-slot rotations: `slot_auto_daily_1/2` and `slot_auto_weekly_1/2`. Slot 1 is newest; slot 2 is the previous snapshot. Manual saves remain independent.
- A failed world-time/day operation pauses the campaign, discards the active world from runtime, and returns the renderer to the title menu. The fatal dialog includes the failure source/message and a copyable text area containing the matching JSONL error record plus up to five records before and after it. Process-level uncaught exceptions and unhandled rejections are logged and terminate the process rather than continuing in an unknown state.
