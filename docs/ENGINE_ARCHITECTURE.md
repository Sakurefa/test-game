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

A Mod may add registry entries and definitions through `registry/` and `content/` JSON or INI files. The engine validates IDs and cross-references before the catalog is usable. Duplicate IDs and unresolved references stop catalog compilation with an actionable error. Mods cannot execute scripts or provide runtime hooks.

Core definitions currently use:

- `universe.json`: universe, systems, locations, colonies and trade routes.
- `economy.json`: commodities, production recipes, companies, securities and markets.
- `factions.json`: faction definitions.
- `military.json`: ship classes, fleet compositions and active wars.
- `events.json`: declarative event definitions.
- `registry/definitions.json`: stable ID/type declarations.

The initial implementation intentionally does not decide the final rules for taxation, credit, debt, labor markets, interstellar shipping, tactical damage models, diplomacy, or player trading. Those systems can evolve independently without changing the world-state contract.

## Determinism

A world stores both the original seed and the current PRNG state. Advancing the same catalog and state produces the same results. Random state is part of the save format; loading a save does not restart its random sequence.

## Current prototype boundary

The first prototype advances in daily steps. Colony production and market pricing are live. Fleets, ship classes and war state are registered, validated and displayed, but tactical combat, fleet movement, logistics between colonies, diplomacy and player financial orders are not implemented yet.
