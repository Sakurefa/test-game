# World Simulation Architecture

The project is a multi-system frontier simulation. A commodity exchange is one subsystem of a shared world, not the central game loop.

## Subsystem boundaries

- **Universe:** star systems, locations, travel lanes, ownership and spatial relationships.
- **Colonies:** population, stability, inventories, facilities and development.
- **Production:** data-defined recipes, inputs, outputs, workforce and operating efficiency.
- **Economy:** commodities, companies, markets, securities and later player orders/accounts.
- **Military:** ship classes, fleets, readiness, orders, wars, fronts and later real-time battles.
- **Simulation kernel:** continuous campaign clock, seeded random state, annual/monthly/weekly/daily/manual simulation-system cadence, typed event history and save validation.
- **Presentation:** renderer only displays snapshots and sends player commands. It does not own authoritative simulation state.

## Runtime contract

The simulation engine is plain Node.js CommonJS under `engine/`. It does not import Electron, browser APIs, or renderer code. The Electron main process owns the active world and exposes a narrow IPC bridge. The renderer receives snapshots and submits commands; it never edits the authoritative state directly.

The Electron main process owns the active world and its campaign-time controller. It samples a monotonic clock, converts elapsed real time through the configured base-day duration and selected 1x–4x speed, and passes fractional game days to the engine. The renderer issues time-control commands and polls a small clock-only IPC payload. It interpolates the visible day-progress bar locally with requestAnimationFrame; full world snapshots are requested only when the authoritative main-process clock crosses a day boundary. UI animation and polling never drive simulation state.

The simulation registry defines stable system IDs, cadence, priority, dependencies and optional initialize/update/save/restore/dispose lifecycle hooks. Its supported cadences are annual, monthly, weekly, daily and manual. Annual systems are due on January 1; monthly systems are due on the first day of each calendar month; weekly systems remain anchored to each seven elapsed campaign days (day 7, 14, 21…); daily systems run on every completed game day. Manual systems run only through their explicit call.

On a shared calendar boundary, scheduled systems run in the fixed phase order **annual → monthly → weekly → daily**. Within a phase, explicit dependencies are respected before configured order; a dependency that would require an earlier phase to wait for a later phase is rejected when the registry is created. Each system records its last execution day in the world save, so repeated scheduler calls or save/load do not run the same system twice on one campaign day. Calendar cadence is derived directly from the current campaign date; it does not scan historical dates or maintain a continuously running calendar watcher.

The currently registered game systems still use weekly production and daily population needs, market pricing and war chronology. A separate persisted Trigger Queue now handles individual date/elapsed-time actions; it does not duplicate recurring cadence. Its first registered System Event resolution is the approved `effect.apply` entry point. Condition/threshold and Domain-Event-driven sources, Command/Event resolutions, generic numeric modifiers and temporary-effect lifecycle are not yet implemented.

The current campaign schedule is:

1. **Every completed game day:** advance the calendar; process previously queued due Triggers; run `campaign.before-day`; then execute due annual/monthly/weekly/daily systems; finally run `campaign.after-day` and append a bounded daily report. Trigger actions therefore happen before cadence consumers on that boundary. Triggers created by hooks during the settlement wait until a later completed day.
2. **Every seventh elapsed game day (day 7, 14, 21…):** run colony industries once before that day’s market repricing, consuming inputs before adding outputs.
3. **On January 1 / the first day of each month:** make annual/monthly systems eligible before weekly and daily systems on the same day. No annual or monthly gameplay system is registered yet.
4. **Between date boundaries:** retain fractional day progress in the active world state; explicit world saves persist that fraction without triggering daily systems.

The initial base rate is one game day per 60 real seconds at 1x. The 1x–4x multiplier is independent of this rate and can be tuned through `setting/simulation.ini` (`base_day_seconds`). New games and loaded games start paused. The engine clock itself does not depend on wall-clock timestamps.

A saved game records its world schema version, content fingerprint, calendar date/day/fraction, scheduler markers, random state, dynamic entities, population groups, persisted Trigger Queue and recent Trigger/command receipts. Legacy world schemas 1–8 migrate to schema 9 while preserving campaign time and existing entities. The migration initializes missing finance, command receipt, Mod-state, domain-event, population-group and Trigger Queue fields as required by each source schema; legacy scalar colony population is converted once into a neutral group. Schemas 1–6 retain the documented one-time legacy content-fingerprint upgrade, while schema 7 keeps strict Mod/script fingerprint checks subject to the exact recorded compatibility alias. Loading against unrelated content remains rejected explicitly.
 
## Mixed INI and JavaScript Mod contract

Mod manifests, registry declarations, entity definitions, balance data and localization remain INI. API v3 continues to support INI-only packages. API v4 may add explicitly declared JavaScript files under `scripts/` and named hooks under `[hooks]` in `manifest.ini`. JSON Mod files and inline JSON values remain forbidden. Core is required and cannot be disabled. JS hooks receive detached frozen snapshots and return only registered effects/events; they do not receive a mutable world reference or general Node/Electron APIs.

Core definitions are divided into:
- `universe.ini`: universe, systems, locations, colonies and trade routes.
- `economy.ini`: commodities, production recipes, companies, securities and markets.
- `factions.ini`: faction definitions.
- `military.ini`: ship classes, fleet compositions and wars.
- `events.ini`: declarative event definitions.
- `registry/definitions.ini`: stable ID/type declarations.
- `localization/zh-CN.ini`: Chinese player-facing strings referenced by stable keys.

Content sections use `[type.stable-id]`; the singleton universe uses `[universe]`. Repeated nested records use numbered keys, and simple lists use semicolon-separated values. The loader normalizes these INI sections into validated engine objects. Player-visible names, descriptions, government labels and commodity units are stored only in locale INI files. The catalog rejects missing localization references, duplicate IDs and unresolved cross-references before a world can start.

JavaScript hooks are optional behavior extensions, not arbitrary patches. The current Node `vm` wrapper reduces exposed capabilities and bounds synchronous execution, but it is not a hardened security boundary against deliberately hostile code. Treat JS Mods as trusted/opt-in until process-level sandboxing exists.

## Determinism and domain events

A world stores its original seed and each named PRNG stream state. Stream IDs are stable simulation identifiers, and independent market-instrument streams prevent unrelated systems from perturbing one another. Formula calculations are synchronous and versioned; each execution records inputs, modifiers, intermediate steps, actual random draws and its result. Audit history is bounded and saved, and reading it does not consume randomness.

The engine appends typed Domain Events with monotonic sequence IDs, campaign day/date, scope, subject and JSON-safe payload. These records describe completed facts. A System Event is a different object: it is a transient processing request emitted by a due Trigger and passed to a registered Engine resolution; it is not a second persisted event history or a direct Event Bus message. The retained history is bounded independently from the localized narrative event feed. Production, market settlement and active-war chronology emit events with stable day/entity idempotency keys. A repeated emission with the same key and same fact returns the existing record; reusing a key for a conflicting fact is rejected. The history validates key uniqueness and sequence continuity, and event records survive save/load. Legacy schema migrations begin a fresh typed history because earlier saves did not contain these events.

Save validation rejects non-finite or negative stockpiles, invalid stability/population values, non-positive or non-finite quotes, malformed account structure/balances and inconsistent domain-event, command-receipt or Mod-state records. Current integer account balances are authoritative runtime values; ordinary operations do not derive them by replaying diagnostic transaction history.

## Validated commands, event delivery and main-process gateway

The engine provides a reusable command dispatcher and world-command runtime. A command envelope contains a unique `commandId`, a stable command `type` and a JSON-safe `payload`. Each registered handler supplies synchronous validation and execution, with an optional authorization check. Validation and authorization receive detached, deeply frozen world snapshots; execution receives an isolated mutable world draft. An optional world validator runs before the draft can be committed. If validation, authorization, the handler, post-transition validation or event persistence fails, the original world object remains unchanged.

Successful commands append a bounded receipt to the world. The receipt stores the command ID, command type, canonical payload signature, campaign day and result. Replaying an identical command ID and payload returns the original result without applying the transition or emitting its events again; replays must still pass authorization. Reusing an ID for different intent is rejected. The saved receipt window retains the latest 256 commands. This is a bounded retry/idempotency boundary, not a substitute for durable transaction IDs in a financial ledger.

Handlers return event descriptors rather than publishing directly. The world-command runtime commits the state draft and receipt, appends those events to the same persisted domain-event history, and then publishes newly committed records through an optional event bus. Subscribers receive detached, deeply frozen event snapshots. Subscriber failures are isolated and exposed as delivery diagnostics.

The Electron main process now owns a trusted world-command gateway and exposes a narrow `world.dispatchCommand()` preload method. The renderer submits only a command envelope; the main process derives actor identity from the active world's player faction and never accepts an actor/permission object from the renderer. The gateway currently registers only `finance.transfer`. It validates source ownership, open-account status, currency equality, exact minor-unit amounts and available funds. This is a gateway foundation, not yet a complete player trade UI or an order-book implementation. Future commands should be explicitly registered and authorized rather than accepting arbitrary handler names from IPC.

## Financial account and ledger contract

World schema 8 retains the canonical `finance` account model introduced in schema 6. Accounts have stable IDs, owner identity, currency, integer minor-unit balances, overdraft policy, status and positions. The player account is `player-main`; the system treasury is the balancing account used for opening capital and external settlement flows. CR uses two decimal minor units.

Account balances are authoritative runtime state. A validated transfer checks its inputs and affected accounts, updates the two balances directly and returns a diagnostic transaction fact; the fact is recorded through domain events/logs rather than replayed to calculate ordinary balances. The legacy transaction arrays in older saves may still be read for compatibility but are not the current balance source. The only registered player-facing gateway command is `finance.transfer`; it currently has no dedicated in-game transfer UI. Market orders, share settlement, loans, dividends and company operating payments are not implemented.

World schemas 1–7 migrate to schema 8. Legacy cash/holdings are preserved and converted to the current integer account representation. Schema 1–6 saves retain their one-time exact INI-only fingerprint migration; schema 7 saves gain neutral population groups while retaining strict Mod/script fingerprint checks, apart from the separately documented exact prior-catalog compatibility alias.

The engine and main-process gateway are now connected, but no market buy/sell order, share ownership transfer, loan, dividend, company operating-cost or logistics payment command is registered yet. The ledger is the reusable accounting seam those systems will use; its presence does not imply those game mechanics are complete.

## Current prototype boundary

The campaign world now runs continuously under pause and 1x–4x controls. Market repricing and war chronology are daily systems; colony production is weekly. Fleets, ship classes and war state remain static registered data. Tactical combat, fleet movement, logistics between colonies, diplomacy and player financial orders are not implemented. Tactical combat is explicitly deferred and will require its own independent real-time simulation rather than being added to the campaign scheduler.

Each colony persists a generic `populationGroups` map. The count in each group is an authoritative part of the colony's population, and the colony total is calculated by summing those group counts. The legacy scalar `population` remains as a derived compatibility projection for systems that need only the total; it is recalculated after every population-group change and checked against the group sum at save/day boundaries. It is not an independent population source. The Engine validates stable group IDs and independent dimension proportions; it does not simulate residents individually or infer intersections between independent dimensions.

Mods may initialize groups through registered `population_group` INI definitions. When any enabled Mod defines groups for a colony, those groups constitute the complete initial population and their sum becomes the runtime total; the Engine does not append an automatic remainder. When no Mod defines groups, the colony definition's `population` value is used once to create a neutral `unclassified` group. Schema 1–7 saves migrate by converting their legacy scalar total into that neutral group; after migration, group counts are authoritative. The empty group-definition collection is excluded from the content fingerprint, preserving existing schema-8 saves until a Mod actually adds initial group content. No actual demographic composition has been added to Core; daily needs still use the derived colony total, not per-group demand.
 
## World model and future subsystem seams

### Spatial and political layer

The universe is a graph, not a flat list. Star systems declare coordinates and neighboring systems; locations belong to one system; colonies attach to locations; factions can control systems, locations and colonies. Trade routes are explicit edges with travel time, risk and capacity. The current scenario validates these relationships but does not yet simulate ships or cargo moving along them.

Future ownership changes should be represented as world-state commands and logged events, rather than editing Mod definitions. Mod data defines the initial world and available content; player and AI actions change the running world.

### Colony and production layer

A colony owns its population, stability, stockpiles and industry instances. An industry selects a data-defined recipe and level. A recipe declares commodity inputs, outputs and optional workforce requirements. Production consumes inputs before adding outputs, preventing a single batch from using its own output as an input.

The current prototype models industry throughput from level and stability and consumes available input stock. A first population-demand layer also runs daily: Core/Mod commodity definitions may specify `daily_need_per_thousand`, measured in commodity units per 1,000 residents per game day. The versioned `economy.population-needs` formula calculates requested, consumed and unmet quantities plus per-commodity satisfaction. The scheduled `population.needs-consumption` system applies only the quantity actually available, after weekly production and before daily market pricing. Results are retained on each colony as `lastNeedsReport` and emitted as `colony.needs-settled` facts.

This is still an aggregate colony-total needs calculation, not per-group demand settlement. The underlying population storage is already group-authoritative: group counts define the colony total, and the scalar population field is only a derived compatibility projection. Needs shortfalls are observable but do not yet change population, health or stability. Group-specific demand, demographic transitions, substitution, workforce allocation, wages, facility upkeep, pollution, service demand, construction queues and local logistics remain future systems.

### Commerce and finance layer

Commodities are physical goods; securities are financial instruments issued by companies. A market belongs to a colony and quotes only the instruments it lists. Current commodity prices react to local inventories, while company securities receive a small seeded operational signal and market noise.

Account balances are stored as integer CR minor-unit values and are authoritative for runtime calculations. Transfer facts are recorded to the event/diagnostic stream; no historical replay is required for ordinary balance reads. Portfolio positions remain on account records, while actual share trading and valuation still need their own order and settlement commands.

### Strategic military and tactical battles

The strategic layer owns factions, fleets, locations, readiness, morale, war declarations, fronts, objectives, supply and campaign outcomes. A fleet is a strategic entity even when it is assigned to a tactical encounter.

A tactical battle should be its own bounded simulation instance with participating fleets, ship instances, formations, orders, combat state and outcome. It should not be implemented by advancing the entire universe once per animation frame. Campaign time and battle time are separate domains: a battle uses a fixed simulation timestep, while the strategic world advances only according to an explicit campaign-time policy. Battle results return to the world through a validated outcome transaction.

This separation is essential for pause, speed controls, AI battles, save/load and future multiplayer possibilities. No tactical damage model or command model is assumed in the current prototype.

## Simulation ordering and system contracts

New simulation systems should be registered with stable IDs, explicit cadence, deterministic priority and declared dependencies. A system may optionally provide initialization, update, save, restore and disposal hooks. Systems must not depend on renderer timing, Electron APIs, audio playback or direct DOM state. Cross-system state changes remain inside authoritative system updates, while completed production, market settlement and active-war chronology emit typed domain events. Validated player/AI command dispatch is now available as an engine service. Future gameplay systems still need to register concrete commands and route player/AI intent through the world-command runtime; UI controls must not gain direct access to world objects.

The registry supports annual, monthly, weekly, daily and manual cadences. Annual systems are due on January 1; monthly systems are due on the first calendar day of each month; weekly systems remain anchored to every seven elapsed days (day 7, 14, 21…); daily systems run at each completed campaign-day boundary. Coincident recurring systems run in annual → monthly → weekly → daily phase order, then respect dependencies and configured order. The scheduler records each system's last run day. Current consumers remain weekly colony production and daily population needs, market pricing and active-war chronology; no annual or monthly gameplay system is registered yet.

Recurring cadence is distinct from the future persisted Trigger Queue. Cadence owns repeated system work; an individual Trigger instance owns one scheduled action, such as a one-off date/elapsed-time action or temporary-effect expiry. Trigger instances must reuse the campaign clock's date rules rather than implement a second calendar. The current settlement model processes simulation work only at completed whole-day boundaries; fractional day progress does not run sub-day systems. Trigger actions and their queue removal must occur inside the detached candidate-world day settlement, so they commit together or are discarded together on failure. Domain events are published only after commit. Triggers may invoke only registered, validated Effect/Command/Event actions. Exact trigger phase ordering relative to cadence systems, post-fire retry/idempotency semantics and event-trigger cursor/re-entrancy rules remain to be fixed with the first real consumer; the general Trigger Queue is not implemented yet.
 
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
- **Mod safety:** Content/manifests/localization remain INI. API v4 permits optional trusted/opt-in JavaScript hooks through a narrow registered-effect contract. Future image/audio/font assets may be declared by data manifests and validated for path, size, type and namespace; assets do not grant native-code access or unrestricted host APIs.

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

World schema version 3 introduced named random streams. Schema 4 added typed domain events, schema 5 added bounded command receipts, schema 6 introduced the finance account model, schema 7 added per-Mod persistent state plus the mixed Mod API v4 content-fingerprint rules, and schema 8 added generic persisted population groups. Each stream seed is derived from the saved world seed and a stable lowercase stream ID; each stream advances independently and its state is saved under that ID. Current market noise uses one stream per market instrument (`economy.market.<market-id>.<instrument-id>`). Adding or consuming random values in another market or subsystem therefore cannot shift this instrument's sequence. Stream IDs are persistent simulation identifiers and must never be renamed casually.

Schemas 1–7 migrate to schema 8 while preserving calendar, scheduler, entity and named-stream state where available. Schema 1/2 legacy shared PRNG positions cannot be mapped to independent streams, so those saves begin named streams from the original world seed; future random outcomes intentionally differ from the old shared-stream sequence. Older saves receive empty domain-event, command-receipt and Mod-state collections only where those records did not exist. Schema 1–6 saves may upgrade their old INI-only fingerprint exactly once if the loaded INI content matches; schema 7 saves preserve their existing script fingerprint and gain a neutral population group for each colony that has no group data. The resulting schema-8 save includes the persisted group data. After migration, schema-8 loads remain strict.

The versioned calculation registry currently contains `economy.colony-production` v1, `economy.population-needs` v2, `economy.commodity-price` v2 and `economy.security-price` v2. Production traces expose stability efficiency, requested throughput, stock-limiting inputs, consumed quantities and produced quantities without consuming randomness. Commodity quotes remain inside a 0.1×–10× base-price corridor; securities are limited to ±12% daily movement and a 0.1×–10× initial-price corridor. These guardrails do not affect ordinary Core volatility values but prevent corrupted or extreme inputs from generating runaway quotes. The world save retains the latest 200 calculation records.

Calculation capture is unconditional in the simulation service. A future UI visibility switch must only decide whether the renderer displays already-recorded audit data; it must not be passed into formulas, scheduler systems or random-stream services. Thus enabling/disabling the inspector cannot alter random consumption, formula order or simulation results. Formula IDs in contextual help should resolve to these registry entries rather than duplicate formula text.


### Calculation and event inspectors

The calculation inspector presents a short, localized explanation for the three registered formulas: commodity pricing, security pricing and colony production. It reads recorded formula inputs, steps and results; it does not rerun a formula or derive a second simulation result. Instrument names are resolved from the current catalog snapshot. The complete JSON inputs, steps, modifiers, random draws and result remain available under a separate raw-record disclosure. Unknown future formulas retain a generic raw-data view until a player explanation is added.

The domain-event inspector labels the expected cadence of recurring core facts: one market-price settlement per market per game day, one chronology update per active war per day, one population-needs settlement per colony per day, and one production settlement per colony on weekly boundaries (days 7, 14, 21, ...). Command- or Mod-driven events are labeled event-driven rather than incorrectly presented as daily events. Their payload remains available under a raw-event disclosure. These labels describe the intended scheduler cadence; the engine's idempotency keys and simulation tests remain the actual duplicate-prevention and cadence checks.

Both panels remain read-only renderer projections of the existing world snapshot. Opening, closing, expanding or scrolling them makes no IPC request and sends no visibility flag to formulas, scheduler systems or random streams. The display does not affect simulation results.


## Runtime diagnostics, autosaves and failure handling

- Runtime log records are one JSON object per physical line in `Logs/runtime.log`; startup records use `Logs/startup.log`. Each record carries an ISO timestamp, level, scope and message/payload. Runtime rotation keeps the active file plus four archives; the default cap is 100 MiB per file. Individual records may be up to 16 MiB. This intentionally favors useful diagnostics over tiny logs while keeping disk use bounded.
- Simulation day settlement writes a detailed record containing the day/date, production and market summaries, systems executed and formula calculation records. Typed domain events are written with their complete payload, not only event metadata.
- Account balances are authoritative runtime values. A transfer validates its own inputs and affected accounts, updates balances directly and returns a diagnostic transaction fact. Ordinary finance operations do not replay persisted transaction history to derive balances. Legacy transaction arrays may remain in older saves for compatibility, but they are not the runtime balance source.
- Full save validation runs when loading/migrating a world. The 100 ms campaign clock path and read-only snapshot path do not run full-world validation. A day boundary checks required inputs for that day's systems; it does not replay finance history.
- A day is settled on a detached candidate world. The live world is replaced only after all due systems finish successfully. If a required value/reference is missing or a system throws, the candidate is discarded.
- Each completed game day queues a daily autosave. Days divisible by seven also queue a weekly autosave. Daily and weekly autosaves have separate two-slot rotations: `slot_auto_daily_1/2` and `slot_auto_weekly_1/2`. Slot 1 is newest; slot 2 is the previous snapshot. Manual saves remain independent.
- Every newly written `data/world.json` receives a compact SHA-256 receipt in the same slot's `metadata.ini`: serialized byte count, world schema, campaign day/date and content fingerprint accompany the digest. The digest is calculated over the exact JSON text written by storage.
- On load, the storage boundary recomputes the digest and compares the recorded byte count and world identity fields before returning the state for schema migration/world validation. A mismatch fails the load; a pre-receipt legacy save remains loadable as `legacy-unverified` and gains a receipt the next time it is saved. Listing save slots displays the stored digest as pending load-time verification.
- The receipt is a local integrity fingerprint for accidental or partial file changes, not a signature or proof of authorship; someone who deliberately edits both world data and metadata can recompute it. No receipt work runs on the campaign timer or during ordinary simulation.
- World data and metadata are written with atomic file replacements. If the metadata/receipt replacement fails after the world file is replaced, storage restores the prior world file (or removes the new file for a first save) before returning the error.
- A failed world-time/day operation pauses the campaign, discards the active world from runtime, and returns the renderer to the title menu. The fatal dialog includes the failure source/message and a copyable text area containing the matching JSONL error record plus up to five records before and after it. Process-level uncaught exceptions and unhandled rejections are logged and terminate the process rather than continuing in an unknown state.


## Extensible simulation and mixed Mod API v4

The project now has a documented long-range domain map in docs/SIMULATION_DOMAIN_MAP.md. It covers the shared world kernel and the intended seams for political society, population and labor, public finance, industrial production, companies and ownership, markets, logistics and cargo, exploration, diplomacy, strategic war, research, tactical battle isolation, rendering, assets and audio. The map distinguishes current implementation from future contracts; it is not a claim that every subsystem exists.

### Mod package compatibility

- API v3 remains supported as the original INI-only, data-only format.
- API v4 adds optional declared JavaScript files under each Mod's scripts/ directory and an explicit [hooks] table in manifest.ini.
- Registry declarations, content definitions, localization and manifests remain INI. Inline JSON and JSON Mod files remain forbidden.
- Enabled JavaScript source and hook declarations contribute to the deterministic catalog content fingerprint. A save created with different enabled behavior scripts is not treated as the same content set.
- Scripts are loaded only from declared simple .js filenames. The loader rejects script symlinks, oversized scripts, undeclared JavaScript files, invalid hook IDs and unsupported API versions.

### Current hook sequence

Campaign hooks wrap the candidate day settlement. Colony hooks execute around each colony's weekly production. Market hooks execute around each market's daily price update. War hooks execute after each active war's daily chronology update:

- campaign.before-day
- colony.before-production
- colony.after-production
- market.before-pricing
- market.after-pricing
- war.after-chronology
- campaign.after-day

Hook input is JSON-serialized and detached. The Mod sees a recursively frozen copy, not the mutable candidate world reference. Mod order is sorted by stable Mod ID; hook order follows the engine-defined invocation point. Randomness is derived independently per Mod, hook, campaign day and entity scope, so draws in one Mod or colony do not consume another stream.

### Approved Mod result contract

A hook returns only effects and events. Current registered effects are colony population, stability and stockpile deltas; listed-market quote multipliers; fleet readiness and morale deltas; and participating-faction war-weariness deltas. Each effect has a strict payload field whitelist, checks its entity references, and applies bounded business rules. Unsupported effects reject the day.

Custom Mod events are namespaced under mod.<mod-id>.<event-type>. Effect application itself emits mod.effect-applied, recording Mod ID, hook ID, entity scope, input payload and actual applied result. These facts enter the normal domain-event history and diagnostic logging path.

The current Mod runtime uses Node vm with a fresh context, disabled dynamic string/WASM code generation, synchronous execution timeouts, and bounded input/output sizes. It removes ordinary Node/Electron capabilities and disables global Date and Math.random; the only supplied helper API is deterministic random, clamp and round. However, Node vm is not a hardened security boundary against deliberately hostile JavaScript. The present API is for trusted/opt-in community code. Fully untrusted Mod execution requires a separately permissioned operating-system process or Electron utility-process sandbox; do not market this wrapper as safe for arbitrary downloaded scripts.

### Deliberately unimplemented rails

The long-range design anticipates future hooks and command/event contracts for population needs and workforce, law and government transitions, company finance, market orders/fills, cargo loading/delivery, fleet movement, diplomacy, research and missions. These should be added as the corresponding core domain commands and effects are implemented. Do not turn the Mod runtime into a general world-patching API.

Tactical combat remains outside the campaign scheduler. Future battles use a separate fixed-step simulation instance and return only a validated campaign outcome command.


### Read-only world query layer

The engine now exports a small query registry from engine/queries.cjs. The default registry provides world overview and faction, colony, market, fleet and war summaries. Query results are JSON-detached and recursively frozen, so consumers cannot mutate authoritative state through a returned projection. Input and output sizes are bounded.

This is an engine-side contract and test surface; the renderer still uses the existing campaign snapshot IPC in this revision. Future UI, AI and subsystem integrations should adopt named projections as they are migrated, rather than introducing ad hoc cross-system reads. Query handlers themselves are trusted core code, not JavaScript Mod callbacks.


### Schema v7/v8 content-fingerprint migration

The catalog keeps the current content fingerprint and the legacy INI-only fingerprint. A world migrated from schema 1–6 temporarily carries a migration marker. During load-boundary validation, the legacy fingerprint is accepted only when it exactly matches the current INI-only content; the save is then upgraded to the current fingerprint, including enabled Mod scripts and hook declarations. The marker is removed immediately. Schema 7 saves retain strict script-content checks when gaining population groups; the only additional accepted fingerprint is the exact previous catalog hash already recorded for the additive profession/wealth-tier catalog migration. Schema 8 saves remain strict.
