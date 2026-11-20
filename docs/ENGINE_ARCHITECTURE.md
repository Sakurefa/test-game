# World Simulation Architecture

The project is a multi-system frontier simulation. A commodity exchange is one subsystem of a shared world, not the central game loop.

## Subsystem boundaries

- **Universe:** star systems, locations, travel lanes, ownership and spatial relationships.
- **Colonies:** population, stability, inventories, facilities and development.
- **Production:** data-defined recipes, inputs, outputs, workforce and operating efficiency.
- **Economy:** commodities, companies, markets, securities and later player orders/accounts.
- **Military:** ship classes, fleets, readiness, orders, wars, fronts and later real-time battles.
- **Simulation kernel:** deterministic clock, seeded random state, ordered daily systems, event history and save validation.
- **Presentation:** renderer only displays snapshots and sends player commands. It does not own authoritative simulation state.

## Runtime contract

The simulation engine is plain Node.js CommonJS under `engine/`. It does not import Electron, browser APIs, or renderer code. The Electron main process owns the active world and exposes a narrow IPC bridge. The renderer receives snapshots and submits commands; it never edits the authoritative state directly.

The order for the current daily simulation is:

1. Advance the world clock.
2. Run colony industries in their declared order, consuming inputs before adding outputs.
3. Recalculate commodity quotes from colony stock levels, then apply seeded market noise.
4. Advance active-war chronology.
5. Store a bounded daily report and the updated random-generator state.

A saved game records its world schema version, content fingerprint, clock, random state and dynamic entities. Loading against a different content fingerprint is rejected explicitly rather than silently binding saved entities to changed Mod definitions. A future migration layer can replace this strict first version.

## Data-only Mod contract

A Mod may add registry entries and definitions through `registry/` and `content/` JSON or INI files. Player-facing names and descriptions are referenced by stable localization keys and resolved from `localization/`; translated strings do not live in content definitions. The engine validates IDs, cross-references and localization keys before the catalog is usable. Duplicate IDs, unresolved references and missing strings stop catalog compilation with an actionable error. Mods cannot execute scripts or provide runtime hooks.

Core definitions currently use:

- `universeINI files`: universe, systems, locations, colonies and trade routes.
- `economyINI files`: commodities, production recipes, companies, securities and markets.
- `factionsINI files`: faction definitions.
- `militaryINI files`: ship classes, fleet compositions and active wars.
- `eventsINI files`: declarative event definitions.
- `registry/definitionsINI files`: stable ID/type declarations.\n- `localization/zh-CN.ini`: Chinese display strings referenced by content keys.

The initial implementation intentionally does not decide the final rules for taxation, credit, debt, labor markets, interstellar shipping, tactical damage models, diplomacy, or player trading. Those systems can evolve independently without changing the world-state contract.

## Determinism

A world stores both the original seed and the current PRNG state. Advancing the same catalog and state produces the same results. Random state is part of the save format; loading a save does not restart its random sequence.

## Current prototype boundary

The first prototype advances in daily steps. Colony production and market pricing are live. Fleets, ship classes and war state are registered, validated and displayed, but tactical combat, fleet movement, logistics between colonies, diplomacy and player financial orders are not implemented yet.


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

## Simulation ordering and determinism

The daily campaign step currently follows a fixed order: colony production, local market repricing, war chronology, clock commit and daily report. New systems should be assigned explicit phases and stable ordering. Systems should not mutate unrelated subsystems' state without a clear contract.

The current PRNG is deterministic and its state is saved. As more systems are added, random streams should be separated by stable subsystem keys (for example economy, events and military). Otherwise adding one random event could change every later market quote, making balance tests and save replays harder to compare.

## Development roadmap

1. **World kernel (current):** validated universe graph, locations, factions, colonies, recipes, commodities, markets, fleet definitions, seeded time and save/load.
2. **Colony simulation:** workforce, population needs, facility upkeep, storage limits, stability modifiers, construction and colony development.
3. **Logistics:** ships and convoys travel through route graphs, use travel time and capacity, face route risk, and move physical stock between locations.
4. **Economic agency:** company accounting, operating costs/revenue, player orders, ownership, fees, debt and financial reporting.
5. **Strategic warfare:** fleet movement and orders, supply, fronts, objectives, faction AI, war weariness and territorial change.
6. **Tactical combat:** separate real-time battle instances, ship behavior and orders, damage, retreat, casualties and campaign outcome application.
7. **Living world:** event scheduling, diplomacy, policies, missions, additional content and community scenarios.

Each phase should be playable and testable before the next adds complexity. The goal is not to finish seven disconnected subsystems; it is to make each one read and change the same persistent world.
