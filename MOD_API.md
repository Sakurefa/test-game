# Mod API v4 — INI content with optional JavaScript hooks

The game uses two different Mod layers:

- **INI is the content format.** Manifests, registry declarations, entity definitions, balance data and localization remain INI.
- **JavaScript is optional executable behavior.** A Mod may declare small hook functions that receive detached snapshots and return a bounded list of approved effects and events.

The engine remains authoritative. A hook cannot hand the engine an arbitrary world object patch, call arbitrary command handlers or import Node/Electron modules. Every returned effect must use a registered effect type.

API v3 data-only packages remain supported. API v4 enables the optional scripts and hooks section.

## Package layout

A package may contain:

    mods/
      my-mod/
        manifest.ini
        registry/
          definitions.ini
        content/
          extra-content.ini
        localization/
          zh-CN.ini
        scripts/
          hooks.js

Core remains required and always enabled. Other packages can be disabled in game settings.

## Manifest

API v3 packages may keep their existing manifest and remain data-only.

An API v4 package declares scripts and hook targets explicitly:

    [mod]
    id = example-market
    name = "Example Market"
    version = 1.0.0
    author = "Community"
    description = "A small example using a monthly observation hook."
    api_version = 4

    [files]
    registry = definitions.ini
    content = market-events.ini
    localization = zh-CN.ini
    scripts = market-events.js

    [hooks]
    campaign.after-day = market-events.js:onCampaignAfterDay

File lists are semicolon-separated. Empty values mean no files in that category. Only simple filenames in the matching package directory are accepted. Scripts are read only from scripts/ and only when declared in the manifest. Undeclared JavaScript files are rejected.

## Registry

Registry declarations use INI section suffixes:

    [entry.my-star-system]
    type = star_system

    [entry.my-colony]
    type = colony

Supported content types currently include universe, star_system, location, trade_route, faction, colony, commodity, recipe, market, company, security, ship_class, fleet, war, event, profession, wealth_tier and population_group.

Population classification is defined on two independent axes. A profession describes an occupation; a wealth tier describes an economic position. A population group can later reference one of each, so the model does not need a hard-coded profession/wealth combination.

    [profession.miner]
    name_key = population.profession.miner.name

    [wealth_tier.low]
    name_key = population.wealth_tier.low.name

Core currently supplies only neutral `unassigned` and `unclassified` definitions and does not author a demographic composition. Any Mod may reference catalog categories from a `population_group` definition. Population groups are initialized from enabled Mod INI data; a colony with no group definitions still receives one neutral `unclassified` group. These definitions do not activate employment, wages, need baskets or market settlement.

Population groups are internal initialization data and do not require a player-facing `name_key`. Register each group under `[entry.<group-id>]` with `type = population_group`. Define it in any declared content INI file using this structure:

    [population_group.new-dawn-workers]
    colony_id = new-dawn-colony
    population = 2100000
    dimension.profession = unassigned:0.75;miner:0.25
    dimension.wealth_tier = low:1
    dimension.capability = trained:0.4;untrained:0.6

Each group has a stable ID, one colony reference, a non-negative population count and zero or more independent dimensions. A dimension is written as `dimension.<dimension-id>`; its semicolon-separated entries use `category-id:proportion`, with proportions between 0 and 1 and summing to 1. Profession and wealth-tier category IDs are checked against their respective registered definitions. Other dimension IDs remain generic stable IDs and are checked structurally.

The counts in the declared groups compose the colony's entire initial population; their sum becomes the runtime colony total. Do not add partial populations on top of an automatic default. When at least one enabled Mod defines groups for a colony, the Engine uses those group counts as the complete population and does not create an extra `unclassified` remainder. Only when no Mod defines any group for a colony does the Engine create one neutral `unclassified` group using the colony definition's `population` value as a fallback starting count. Group definitions from different Mods share one global stable-ID namespace.

## Content definitions

Each entity uses a [type.stable-id] section; the singleton universe uses [universe]. Field names use snake_case. Scalar values are strings, finite numbers, booleans or null. Lists use semicolons. Repeated nested records use numbered keys.

    [universe]
    id = my-universe
    start_date = 2478-04-01
    default_player_faction_id = my-faction
    name_key = entity.my-universe.name

    [colony.my-colony]
    location_id = my-planet
    faction_id = my-faction
    population = 1250000
    stability = 72
    stockpile.ore = 140
    industry.1 = mining-recipe:2:-

    [recipe.mining-recipe]
    input.1 = ore:2
    output.1 = alloys:1.5

Nested tuple fields:
- stockpile.<commodity-id> = quantity
- industry.N = recipe-id:level:company-id; use - when there is no company.
- input.N / output.N = commodity-id:quantity
- ship.N = ship-class-id:quantity

## Localization

Player-visible text remains in locale INI files. Content definitions refer to stable localization keys and never embed translated UI text.

    [language]
    locale = zh-CN
    display_name = "简体中文"

    [content]
    entity.my-universe.name = "我的星域"
    entity.my-universe.description = "由多个星系组成的边境区域。"

Every entity needs name_key. Optional description_key, government_key and unit_key references must also resolve in the default locale.

## JavaScript hook functions

A script is an ordinary JavaScript file containing named functions. Do not use imports, exports, require or Node module conventions.

    function onCampaignAfterDay(input, api) {
      if (input.day % 30 !== 0) return {};

      return {
        events: [{
          type: "monthly-observation",
          payload: {
            day: input.day,
            marketCount: Object.keys(input.world.markets).length,
            roll: api.random()
          }
        }]
      };
    }

A hook receives two arguments:

- input: a detached, recursively frozen JSON snapshot for that hook point. Editing it does not edit the live game. The input includes modState, a snapshot of only this Mod's own persistent state.
- api: a small helper object with deterministic random(), clamp(value, min, max) and round(value, digits).

Each Mod owns a persistent key/value state namespace stored in the world save. Use it for counters, event-chain stages, mission progress or Mod-specific rules:

    function onCampaignAfterDay(input) {
      if (input.day % 30 !== 0) return {};
      return {
        effects: [{
          type: "mod.state.increment",
          payload: { key: "months-observed", delta: 1 }
        }],
        events: [{
          type: "monthly-observation",
          payload: { completedMonths: (input.modState["months-observed"] || 0) + 1 }
        }]
      };
    }

The state namespace is isolated by Mod ID. A hook can read only its own state snapshot. State changes are still requested as approved effects and are committed with the candidate day; a failed day does not partially save Mod state.

A hook returns an object with optional `effects`, `events` and `triggers` arrays. `effects` request approved world transitions. `events` append completed-fact Domain Events. `triggers` schedule individual future System Events for Engine processing. A hook may return an empty object or undefined to do nothing. It must be synchronous. Promise/async results are rejected.

Mod order is deterministic by stable Mod ID. Hook order follows the declared hook-point sequence within the simulation. A Mod random sequence is isolated by Mod ID, hook ID, campaign day and entity scope. Adding a draw in one Mod or colony does not consume the random stream of another Mod or colony.

## Trigger scheduling and System Events

A hook may return a bounded `triggers` array. Each descriptor has only an ID, a due condition and a System Event request. The Engine supplies the owner Mod ID; a Trigger ID must be namespaced under that Mod.

A direct approved Effect request uses `effect.apply`:

```js
{
  triggers: [{
    id: "my-mod.colony-relief",
    due: { kind: "elapsed", days: 3 },
    event: {
      type: "effect.apply",
      payload: {
        effect: {
          type: "colony.stability.delta",
          payload: { colonyId: "my-colony", delta: 2 }
        }
      }
    }
  }]
}
```

A Resolution receives a detached snapshot of the current candidate world, calculates a result and returns a bounded plan; it does not mutate the authoritative world or apply world changes itself. The Engine's shared Settlement runner (`engine/settlement.cjs`) then applies each planned Effect through the existing registered Mod Effect handler. This runner is independent of the Trigger Queue: it accepts a System Event, Resolution registry and Effect executor, and returns the calculation result plus applied Effect results. It does not own scheduling, Domain Event history or UI. This keeps calculation output separate from authoritative mutation.

The second built-in Resolution, `formula.effect`, evaluates an existing Engine-registered versioned formula and maps selected top-level result fields into approved Effect payloads:

```js
{
  triggers: [{
    id: "my-mod.record-price-estimate",
    due: { kind: "elapsed", days: 2 },
    event: {
      type: "formula.effect",
      payload: {
        formulaId: "economy.commodity-price",
        inputs: {
          basePrice: 20,
          targetStock: 100,
          stock: 35,
          priceElasticity: 1,
          volatility: 0.02,
          previousPrice: 18
        },
        effects: [{
          type: "mod.state.set",
          payload: { key: "price-estimate" },
          resultFields: { value: "price" }
        }]
      }
    }
  }]
}
```

For `formula.effect`:
- `formulaId` must already exist in the Engine formula registry. Mods cannot register formulas or execute arbitrary calculation callbacks through this request.
- `inputs` are a JSON-safe snapshot captured when the Trigger is scheduled. They are not silently refreshed when the Trigger becomes due.
- Each Effect template contains a registered Effect `type`, its static `payload`, and `resultFields` mapping **top-level formula result keys** to Effect payload fields. It is a field binding, not an expression language.
- The formula uses a deterministic random stream derived from the Trigger ID. Its calculation record and random-stream state are retained by the normal candidate-world day commit.
- Formula output and all mapped Effects are validated before the Effect plan is applied. A missing result field or rejected Effect aborts the candidate day; no partial Effect is committed.

Resolution plans contain a JSON-safe result object and at most 16 Effect descriptors. The Effect executor applies them in listed order. Successfully applied Effects emit the normal `mod.effect-applied` Domain Events; the Trigger then emits `trigger.resolved` containing the calculation result and applied Effect results. All records and state changes commit with the day.

Trigger IDs are stable across saves and retries. Re-submitting the same ID with the same definition is ignored while its pending entry or recent receipt is retained. Reusing the ID with a different definition fails validation. The Engine retains the latest 256 Trigger receipts, so this is a bounded replay fence, not a permanent global identity ledger.

The due sources currently are:
- `{ kind: "date", date: "YYYY-MM-DD" }`: a valid campaign calendar date strictly after the current date.
- `{ kind: "elapsed", days: N }`: a positive integer number of completed campaign days.

Both are processed only at whole-day boundaries; fractional day progress does not run Trigger actions. The Engine processes already-due Triggers immediately after advancing the campaign clock, before `campaign.before-day` and before annual/monthly/weekly/daily simulation systems. Triggers created later during that settlement can first run on a subsequent completed day, preventing same-boundary recursion.

A System Event is a transient internal processing request, not a player-facing narrative event and not a Domain Event. It is resolved inside the candidate-world day transaction. The read-only Event Bus receives completed Domain Event facts only after the whole world commits. If a resolution or Effect fails, the candidate day—including effects, event records, queue removal and receipt—is discarded.

The Engine currently registers `effect.apply` and `formula.effect`. It does not yet provide condition/threshold or Domain-Event-driven Trigger sources, Command/Event resolution types, a generic numeric modifier language, temporary-effect lifecycle management, random result pools or Presentation/UI. API v3 data-only Mods remain unaffected.

## Current hook points

| Hook | Called when | Input includes |
| --- | --- | --- |
| campaign.before-day | At the start of a day settlement | Day, date and world projection |
| campaign.after-day | After scheduled systems finish for that day | Day, date, world projection, summary and executed system IDs |
| colony.before-production | Before the colony's weekly production | Day, colony ID and colony projection |
| colony.after-production | After the colony's weekly production | Day, colony, production result |
| market.before-pricing | Before the market's daily pricing update | Day, market ID, market and colony projections |
| market.after-pricing | After the market's daily pricing update | Day, market, colony and price-change projections |
| war.after-chronology | After each active war advances its chronology | Day and war projection |

Hook errors fail the current day settlement. The engine runs day settlement on a candidate world; if a hook or core system fails, the candidate is discarded and the previous completed day remains authoritative. See the runtime error report for the failing Mod ID and hook ID.

## Current approved effects

Effects are requests, not arbitrary object mutations. The engine validates the target and applies the transition. Population group counts are the authoritative runtime population records; the scalar colony total is recalculated from their sum and is only a compatibility/read projection. Split and merge rearrange existing members and therefore preserve that total. A dimension update changes only the selected group's stored distribution; any gameplay rule deciding when such a reclassification occurs belongs in Mod behavior, not in the Engine.

| Effect type | Payload keys | Behavior |
| --- | --- | --- |
| colony.population.delta | colonyId, delta | Adds population to the unclassified group; reductions are distributed proportionally across existing groups; total is recalculated from group counts and cannot become negative |
| colony.population.group.split | colonyId, sourceGroupId, newGroupId, population; optional sourceDimensions and newDimensions | Transfers part of one existing group into a new group; colony total is unchanged. If resulting dimensions are supplied, both maps are required and each dimension's category headcounts must be conserved across the two resulting groups |
| colony.population.group.merge | colonyId, sourceGroupId, targetGroupId | Moves all source members into the target, combines each shared dimension using population-weighted proportions and removes the source group; colony total is unchanged |
| colony.population.group.dimension.set | colonyId, groupId, dimensionId, distribution | Replaces one group's distribution for a dimension without changing its headcount or colony total |
| colony.stability.delta | colonyId, delta | Adjusts stability, bounded to 0–100 |
| colony.stockpile.delta | colonyId, commodityId, delta | Adds/removes stock; result cannot be negative |
| market.price.multiplier | marketId, instrumentId, multiplier | Adjusts a listed quote, bounded to 0.1×–10× its base price |
| fleet.readiness.delta | fleetId, delta | Adjusts readiness, bounded to 0–100 |
| fleet.morale.delta | fleetId, delta | Adjusts morale, bounded to 0–100 |
| war.weariness.delta | warId, factionId, delta | Adjusts weariness for a participating faction; result cannot be negative |
| mod.state.set | key, value | Sets a JSON-safe value in this Mod's own saved namespace |
| mod.state.increment | key, delta | Increments a numeric value in this Mod's own saved namespace |
| mod.state.delete | key | Deletes a value from this Mod's own saved namespace |

Example:

    function onColonyAfterProduction(input) {
      return {
        effects: [{
          type: "colony.stability.delta",
          payload: { colonyId: input.colonyId, delta: 0.5 }
        }]
      };
    }

An unsupported effect type or invalid/missing reference fails the current day. Effects and emitted events are recorded as domain events with Mod ID, hook ID, scope, input payload and applied result.

A Mod may also return custom events. Their type is namespaced as mod.<mod-id>.<event-type>; event payloads retain Mod ID and original event type fields. These are world facts that subscribers can observe; they do not automatically mutate another subsystem.

## Resource and execution limits

Current limits are intentionally small and explicit:

- Up to 16 declared JavaScript files per package.
- Up to 64 hook declarations per package.
- Up to 256 KiB per JavaScript file.
- 50 ms execution timeout by default; configured timeout cannot exceed 100 ms.
- 2 MiB maximum serialized hook input.
- 128 KiB maximum serialized hook output.
- Up to 128 effects and 64 custom events per hook invocation.
- Inline JSON remains forbidden in Mod INI.
- Symlinked package files and undeclared JavaScript files are rejected.

Do not make a long-running loop, schedule background work or perform asynchronous I/O inside a hook. A hook is called only by the simulation at its declared point.

## Capability and trust boundary

Hooks receive no Node require, process, module, exports, network fetch, timers, filesystem handle, Electron API, DOM object or mutable engine service. Global Date and Math.random are disabled; use the deterministic api.random() helper.

The present Node vm wrapper reduces capabilities and bounds synchronous execution, but Node vm is **not a hardened security boundary against deliberately hostile JavaScript**. Do not treat arbitrary downloaded code as safe. Community JS Mods should be trusted/opt-in until the project adds a separately permissioned OS process or Electron utility-process sandbox. The absence of a supplied filesystem API is not a guarantee against every possible JavaScript engine escape.

Never add native modules, executable binaries, arbitrary host callbacks or direct world mutation to the Mod API. New capabilities should be added as named queries and approved effect types with tests.

## INI and file safety rules

- UTF-8 text with [section] and key = value.
- Blank lines and lines beginning with semicolon or hash are ignored.
- Supported scalar values: strings, finite numbers, true, false and null.
- Inline JSON arrays and objects are explicitly rejected in Mod INI files.
- Maximum manifest size: 64 KiB; each INI file: 2 MiB.
- Duplicate sections/keys, unsafe keys, symlinks and path traversal are rejected.
- Game content, registry and localization remain INI; JavaScript is only for the optional behavior layer.


### Legacy save content fingerprints

Schema 1–6 saves retain their existing one-time INI-only fingerprint upgrade when the current INI content is byte-for-byte equivalent; the upgraded fingerprint includes the enabled API v4 script sources and hook declarations. Schema 7 saves migrate to schema 8 by adding neutral persisted population groups from their existing scalar colony totals. This schema migration does not relax content-fingerprint checks for changed Mod data or scripts.

One narrow additive-content exception also exists for the population classification catalog addition: a Schema-7 save from the immediately previous catalog can be upgraded when all prior content and the exact enabled JavaScript extension set match. Only the two new classification collections are excluded when computing that one compatibility fingerprint. This does not authorize arbitrary Schema-7 content changes; changes to existing definitions, enabled scripts or hook declarations still cause a fingerprint mismatch.
