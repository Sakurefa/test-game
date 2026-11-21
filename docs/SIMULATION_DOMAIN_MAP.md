# Simulation domain map and extension contracts

This document is the long-range implementation map for the shared campaign world. It is a planning contract, not a claim that every listed gameplay feature is already implemented.

## 1. Design target

The intended game combines several simulation traditions:

- **Victoria-style society and statecraft:** population groups, needs, labor, institutions, laws, taxation, interest groups, political pressure, diplomacy and large-scale war.
- **Starsector-style frontier and fleet operations:** star systems, locations, colonies, exploration, ships, fleets, convoys, route travel, supply and independent tactical encounters.
- **simCompany-style production and business:** production chains, inputs and outputs, facilities, inventories, contracts, companies, prices, cash flow, shares, investment and debt.

They should not become three separate games glued together. They must operate on the same authoritative world, share stable identities and communicate through explicit commands, events and read-only projections.

The engine should remain plain Node.js modules. Do not add a framework for its own sake. A subsystem is a module with a clear state contract and a small set of registered commands, events and scheduled updates.

## 2. Shared world kernel

| Domain | Owns | Required interface |
| --- | --- | --- |
| Identity | Stable IDs, entity type, owner and source Mod | catalog.get(type, id), stable namespaced IDs, reference validation |
| Time | Campaign date, elapsed day, day fraction and scheduled boundaries | clock.read(), scheduler.register(), daily/weekly/manual cadence |
| State | Authoritative runtime values and save schema | world.read, scoped state projections, schema migration |
| Commands | Player, AI, scenario and Mod intent | commandId/type/payload, trusted actor, validation, execution and result |
| Events | Facts that have already happened | stable event type, sequence, day/date, subject, payload and idempotency key |
| Queries | UI, AI and Mod read access | named read projections; never hand out mutable world references |
| Randomness | Independent deterministic streams | stable stream ID and saved stream state |
| Formulas | Versioned deterministic calculations | formula ID/version, inputs, intermediate facts and result |
| Persistence | Manual, daily and weekly saves, migration | serialize authoritative state; no debug log replay |
| Diagnostics | Operation and failure evidence | source, entity, command/hook ID, inputs, result, error and surrounding context |

**Command rule:** a command expresses intent (“buy”, “build”, “move”, “enact law”). It does not directly mutate a UI model. The trusted main process resolves actor identity, the engine validates the request and then commits it.

**Domain Event rule:** a Domain Event describes a completed fact (“cargo arrived”, “law enacted”, “fleet retreated”). The history stores facts and the Event Bus delivers immutable read-only snapshots after commit; it is not a hidden command channel.

**System Event rule:** a System Event is a transient internal request for Engine processing, created when a persisted Trigger becomes due. A registered Resolution returns a JSON-safe result and a list of approved Effect descriptors; the reusable Settlement runner in `engine/settlement.cjs` applies those Effects in a separate step. Trigger scheduling and receipts remain outside the Settlement runner. The request is not a player-facing description and is not the same object as a Domain Event. Presentation may later turn committed facts into notifications, reports or other UI.

**Query rule:** user interfaces and read-only Mod hooks receive detached projections. They cannot change the live world by editing an object.

## 3. Society, population and politics

### Population and social structure

The first executable step currently uses each colony's aggregate population; population cohorts remain a later migration of the data model.

- **Implemented — daily commodity needs:** Core/Mod commodity definitions may provide `daily_need_per_thousand` (commodity units per 1,000 residents per game day). The daily population-needs system runs after weekly production and before market repricing, consumes only available inventory and records demand, actual consumption, unmet quantity and satisfaction per commodity.
- **Not yet implemented — cohort identity:** colony, culture, social class, profession, ideology, wealth band and legal status.
- **Not yet implemented — demography:** births, deaths, migration, assimilation, displacement and cohort growth.
- **Not yet implemented — richer needs:** subsistence, everyday and luxury baskets, substitution and preference differences between cohorts.
- **Not yet implemented — labor:** available workers, skills, employment, wages, unemployment and workplace conditions.
- **Not yet implemented — social conditions:** wealth, literacy, health, security, radicalization and mobility.

Current needs shortfalls are visible and recorded; they do not yet directly change population or stability.

Interfaces:
- Events: `colony.needs-settled` (implemented daily aggregate demand fact); future cohort lifecycle and migration events remain planned.
- Commands: population.create-cohort, population.migrate, population.assign-work.
- Read projections: cohort totals, needs satisfaction, labor supply, employment and migration flows.

Population simulation should be an ordinary scheduled system. UI widgets must not calculate population or mutate a cohort.

### Interest groups and government

Plan for interest groups, political movements and membership; support, approval, clout, ideology, demands and alignment; government composition, legitimacy, institutions and administrative capacity; laws, policies, enactment time, opposition and enforcement; elections, succession and regime changes when a scenario needs them.

Interfaces:
- Commands: politics.propose-law, politics.enact-law, politics.form-government, politics.suppress-movement.
- Events: politics.law-proposed, politics.law-enacted, politics.government-changed, politics.movement-formed.
- Queries: law availability, enactment progress, group support, legitimacy and institutional effects.

Do not encode every political rule in the UI. Law definitions, modifiers and text belong in content data; actual transitions belong in engine handlers.

### State and public finance

Plan for treasury, budgets, taxes, tariffs, subsidies, transfers, departments, public services, debt instruments, interest, repayment, default, creditworthiness, public construction, procurement, maintenance and government-owned firms.

Interfaces:
- Commands: finance.set-budget, finance.set-tax, finance.issue-debt, finance.repay-debt, finance.pay-contract.
- Events: finance.tax-collected, finance.debt-issued, finance.payment-settled, finance.default-declared.
- Queries: treasury balance, revenue, expenditure, debt service and budget execution.

All cash movement posts through the authoritative integer-minor-unit account service. A system may calculate a bill, but it cannot silently mint or remove account balances.

## 4. Industry, companies and markets

### Production and facilities

Plan for a directed production graph: recipes with multiple inputs and outputs, workforce, operating time and by-products; facilities with level, throughput, condition, efficiency and construction status; workforce requirements, wages, energy, maintenance and operating costs; storage, spoilage, capacity, input/output buffers; construction queues and upgrades with material, labor, money and time costs.

Interfaces:
- Commands: industry.build, industry.upgrade, industry.change-recipe, industry.set-priority.
- Events: industry.construction-started, industry.facility-completed, industry.production-settled, industry.shortage.
- Queries: recipe availability, planned/actual throughput, limiting input, labor utilization and facility health.

Keep production arithmetic in versioned formulas. A formula returns facts; the owning system applies those facts to the candidate world.

### Companies and ownership

Plan for companies with owner, headquarters, operating sites and board/control data; assets, liabilities, cash flow, inventories, contracts and operating statements; ownership shares, voting rights, dividends, buybacks and public offerings; insolvency, restructuring, mergers, acquisitions and bankruptcy.

Interfaces:
- Commands: company.found, company.acquire, company.issue-shares, company.pay-dividend, company.close-facility.
- Events: company.founded, company.ownership-changed, company.dividend-paid, company.insolvent.
- Queries: balance sheet, income statement, cash flow, ownership table and valuation.

The world stores current company state. Accounting events and structured logs explain how it changed; ordinary gameplay queries must not replay the entire log.

### Commerce and financial markets

Plan for local commodity supply/demand and market access; player and NPC buy/sell orders, matching, fills, cancellations and fees; securities, ownership positions, dividends and valuation; loans, collateral, margin rules, credit, defaults and settlement; contracts, forward delivery, insurance and trade finance.

Interfaces:
- Commands: market.place-order, market.cancel-order, market.settle-fill.
- Events: market.order-placed, market.order-filled, market.order-cancelled.
- Queries: order book, quote history, available inventory, position, realized/unrealized P&L and market depth.

Orders are instructions; fills are completed facts. Cargo and money settlement must be connected but remain separate resources. No share trade should alter cash and ownership through unrelated direct writes.

## 5. Logistics, geography and exploration

### Spatial graph

The universe is a graph of systems, locations, routes and access constraints. Plan for star systems and local locations; stable route edges with travel time, capacity, toll, risk and restrictions; gates, jump points, blockades, hazards, customs and route disruption; ownership, control, occupation and contested access; route availability changing over time.

Interfaces:
- Query: navigation.find-route(origin, destination, movementProfile).
- Commands: fleet.set-destination, convoy.create, route.close, route.reopen.
- Events: route.disrupted, fleet.departed, fleet.arrived, convoy.delayed.

Use one route graph contract for fleets, civilian freighters, migration, couriers and military supply. Each movement type supplies its own speed, access, capacity and risk profile.

### Cargo and freight

Plan for cargo manifests, commodity quantities, owner and source/destination; freighters, capacity, speed, fuel, crew, upkeep and condition; loading/unloading, in-transit ownership, losses, insurance and delivery contracts; convoys, escorts, route selection, travel time and interdiction.

Interfaces:
- Commands: cargo.reserve, cargo.load, cargo.unload, convoy.dispatch, convoy.reroute.
- Events: cargo.loaded, cargo.delivered, cargo.lost, convoy.arrived.
- Queries: available shipping capacity, in-transit stock, ETA, route risk and delayed orders.

Inventory must not teleport between colonies. A transfer creates an in-transit shipment and changes endpoint stock only at load/unload boundaries.

### Exploration and discoveries

Plan for survey orders, exploration ships, sensor reach and discoveries; uncharted locations, anomalies, salvage, ruins and resource deposits; scanning progress, survey costs and discovery ownership; scenario-defined exploration events and rewards.

Interfaces:
- Commands: exploration.assign-survey, exploration.scan, exploration.claim-discovery.
- Events: exploration.survey-completed, exploration.discovery-found, exploration.site-exhausted.

## 6. Strategic military and diplomacy

### Fleets and strategic operations

Plan for ship instances/designs, loadouts, modules, damage, crew and readiness; fleet composition, command capacity, morale, doctrine and orders; movement, patrol, escort, interception, blockade and retreat; fuel, supplies, repairs, reinforcement and maintenance.

Interfaces:
- Commands: fleet.create, fleet.merge, fleet.split, fleet.issue-order, fleet.withdraw.
- Events: fleet.order-issued, fleet.engaged, fleet.supplied, fleet.retreated.
- Queries: strength, readiness, supply days, position, ETA and order state.

A strategic fleet is not a tactical battle. It can be selected as a participant in a future encounter but keeps its strategic identity.

### War, fronts and territory

Plan for war declarations, participants, goals and treaties; operational fronts, objectives, control zones and supply corridors; siege, blockade, occupation, attrition and war exhaustion; reinforcement, strategic AI, peace negotiation and post-war settlement.

Interfaces:
- Commands: war.declare, war.set-goal, war.negotiate-peace, front.assign-fleet, territory.occupy.
- Events: war.started, front.changed, objective.captured, territory.control-changed, peace.signed.
- Queries: front strength, control, supply status, war score and exhaustion.

Supply is a real flow through the same logistics graph, not an unexplained combat bonus.

### Diplomacy

Plan for faction relationships, trust, grievances, prestige and diplomatic weight; treaties, alliances, access rights, trade agreements and guarantees; embargoes, sanctions, tariff agreements, ceasefires and peace; negotiation offers, acceptance conditions and AI priorities.

Interfaces:
- Commands: diplomacy.propose-treaty, diplomacy.accept, diplomacy.reject, diplomacy.cancel.
- Events: diplomacy.treaty-proposed, diplomacy.treaty-signed, diplomacy.embargo-started.
- Queries: relation breakdown, treaty obligations and available diplomatic actions.

## 7. Research, technology, incidents and missions

Plan for technology trees, prerequisites, projects, research points and unlocks; institutions and knowledge transfer; world incidents, crisis chains, timed decisions and contextual narrative; missions, contracts, objectives, rewards, failure and expiry; scenario scripts authored as data plus constrained hooks.

Interfaces:
- Commands: research.start, research.change-project, mission.accept, mission.complete.
- Events: research.completed, technology.unlocked, incident.triggered, mission.expired.
- Queries: prerequisites, research progress, active incident choices and mission state.

Random incidents must use named deterministic streams. A Mod cannot change random state by calling global Math.random().

## 8. Tactical combat boundary

Tactical combat is intentionally not implemented in this foundation batch.

Future combat gets its own runtime: a fixed simulation timestep independent of the campaign day scheduler; battle-local state, participants, ships, formations, orders and combat events; rendering interpolation at any frame rate without driving damage or hit calculation; battle-specific save/replay boundaries; and a validated outcome command such as battle.apply-outcome.

Campaign time during a battle must have an explicit policy (paused, parallel or deferred). Do not let an animated scene silently advance the strategic world.

## 9. Presentation, assets and sound

Plan for stable resource IDs and adapters for textures, images, sprite sheets, animations, tilemaps and scene backgrounds; star maps, colony views, shipyards, fleets and tactical scenes; particles, weather, lighting, camera, UI overlays and transitions; audio clips, music, ambient loops, mixers and event-driven sound cues; fonts, localization, icons and accessibility metadata.

Interfaces:
- assets.resolve(assetId), assets.load(assetId), assets.release(assetId).
- scene.mount(sceneId, snapshot), scene.update(snapshot), scene.dispose().
- audio.play(cueId, options), audio.stop(handle), audio.setBus(busId, value).
- localization.text(key, variables), input.readAction(actionId).

DOM remains suitable for menus, forms, settings and accessible controls. A canvas/WebGL scene implementation can be swapped without changing simulation rules.

All graphics, animation, sound and input presentation remain downstream of world snapshots/events. A slow renderer cannot slow or alter an authoritative simulation result.

## 10. Common subsystem contract

A simulation system should expose only the metadata and callbacks it actually needs:

| Field | Purpose |
| --- | --- |
| id | Stable namespaced system ID |
| cadence | daily, weekly, manual now; event-driven or fixed-step domains later |
| phase/order | Explicit order within a settlement phase |
| dependsOn | Stable IDs of systems that must run first |
| update(args) | Synchronous state transition on the candidate world |
| commands | Explicit command definitions owned by the subsystem |
| events | Event types emitted by completed transitions |

Avoid a universal base class. A subsystem should be a small module plus a registered definition. Add save/lifecycle methods only when a system owns persistent external resources that actually require them.

Recommended phases as the world grows:
1. preconditions — scheduled input collection and world boundary updates.
2. politics — institutions, laws and administrative state.
3. population — demography, needs and labor supply.
4. industry — production, maintenance and construction.
5. commerce — local demand, market pricing and settlements.
6. logistics — movement, loading, delivery and supply.
7. diplomacy — treaties, relations and external decisions.
8. military — fleet orders, fronts, attrition and war chronology.
9. incidents — triggered incidents and mission progression.
10. reporting — immutable projections, day summaries and event publication.

This is a proposed ordering map. The current runtime only has its existing daily/weekly systems; do not claim the future phases exist until they are registered and tested.

## 11. Mod extension surface

A Mod consists of an INI manifest, registry, content and localization; optional JavaScript files under scripts/; explicit hook declarations in manifest.ini; and stable namespaced IDs for its definitions, events and assets.

Current implemented hook points:
- campaign.before-day, campaign.after-day.
- colony.before-production, colony.after-production.
- market.before-pricing, market.after-pricing.
- war.after-chronology.

Current implemented effects:
- Population, stability and stockpile deltas.
- Market quote multiplier (kept inside the existing 0.1x–10x base-price corridor).
- Fleet readiness and morale deltas.
- War weariness delta.
- Mod-scoped domain events.

These are the current rails, not the final API. Future rails should be introduced when the corresponding domain contracts exist: population needs, labor assignment, law evaluation, company finance, orders/fills, cargo loading/delivery, fleet navigation, diplomatic decisions, research and scenario missions.

JavaScript hooks receive detached read-only JSON input and return declared effect/event data. They do not get a mutable world reference or general Node/Electron access. The engine applies only recognized effect types. API v3 INI-only packages remain supported; API v4 adds optional JavaScript hooks.

The current Node vm execution wrapper is a compatibility and capability-reduction layer, **not a hardened security boundary against deliberately hostile code**. Treat community JavaScript Mods as trusted/opt-in until a separate operating-system process/utility-process sandbox with resource and permission controls exists. Do not market the current runtime as safe for arbitrary untrusted scripts.

## 12. Implementation order

A practical build order that keeps each layer playable:

1. Finish the current Mod v4 execution and documentation, with tests for deterministic hooks, effect validation and failure rollback.
2. Add shared read projections so UI, AI and Mods consume the same named queries.
3. Add population cohorts, needs and workforce; connect labor and demand to existing colony/industry data.
4. Add facilities, upkeep, storage capacity and construction commands.
5. Add actual freight: cargo manifests, freighter capacity, route travel, loading/unloading and delivery.
6. Add company accounts and financial statements, then market orders/fills and ownership settlement.
7. Add faction relations, treaties, laws and interest groups.
8. Add fleet movement, route supply, fronts, territorial control and strategic objectives.
9. Add research, scenario incidents, missions and campaign content.
10. Add the isolated tactical combat runtime.
11. Expand asset, audio, animation and scene adapters in response to actual scenes and content needs.

The goal is a large number of stable attachment points, not a large abstract framework. Add each rail as a real consumer needs it, retain clear ownership of state, and keep every transition inspectable through commands, events and logs.


## Read-only world query contracts

The engine also exposes a small query registry, separate from commands and events. Queries return detached, recursively frozen JSON projections; they are suitable as a common observation shape for UI, AI and other trusted engine consumers. They do not provide a write path.

Current core query IDs:
- world.overview
- faction.summary
- colony.summary
- market.summary
- fleet.summary
- war.summary

A query accepts a JSON object payload, reads the authoritative world/catalog through its registered engine handler, and returns a detached value. Unknown IDs, invalid input and oversized input/output are rejected. Query handlers are internal trusted engine code; they are not user-supplied JavaScript callbacks.

The query registry is exported from engine/index.cjs. The renderer is not yet migrated to request all of its data through these queries; its current world snapshot interface remains in place. New UI panels, AI routines and domain modules should prefer stable named projections over reaching into another subsystem's internal data shape.
