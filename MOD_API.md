# Mod API v4 — INI content with optional JavaScript hooks

The game uses two different Mod layers:

- **INI is the content format.** Manifests, registry declarations, entity definitions, balance data and localization remain INI.
- **JavaScript is optional executable behavior.** A Mod may declare small hook functions, versioned formulas and recurring simulation systems. Hooks receive detached snapshots and return bounded approved Effects, Domain Events, Triggers and calculation records.

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

Supported content types currently include universe, star_system, location, trade_route, faction, colony, commodity, recipe, market, company, security, ship_class, fleet, war, event, profession, wealth_tier, population_group, currency and financial_account.

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
- api: a small helper object with deterministic random(scope), clamp(value, min, max), round(value, digits), recordStep(id, value, detail) and recordModifier(id, value, reason). Random scopes are deterministic and isolated within the invoking Mod hook.

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

A hook may return a bounded `triggers` array. Each descriptor has an ID, a due condition and a System Event request. The Engine supplies the owner Mod ID; a Trigger ID must be namespaced under that Mod.

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

A Resolution receives a detached snapshot of the current candidate world and returns a bounded plan. It does not mutate authoritative state or write Domain Event history itself. Its plan may contain a JSON-safe `result`, up to 16 approved `effects`, and optionally up to 16 `domainEvents`. The shared Settlement runner (`engine/settlement.cjs`) applies planned Effects through the registered Effect executor and returns the result, applied Effect outcomes and Domain Event descriptors. It does not own the Trigger Queue or write the event history.

The `formula.effect` Resolution evaluates a versioned formula registered by an enabled Mod and maps selected top-level result fields into approved Effect payloads:

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
- `formulaId` must already exist in the loaded Mod formula registry. A Mod must explicitly declare the formula in its API v4 manifest; arbitrary calculation callbacks are not accepted through this request.
- `inputs` are a JSON-safe snapshot captured when the Trigger is scheduled; they are not silently refreshed when the Trigger becomes due.
- Each Effect template contains a registered Effect `type`, static `payload`, and `resultFields` mapping top-level formula result keys to Effect payload fields. This is field binding, not an expression language.
- The formula uses a deterministic random stream derived from the Trigger ID. Its calculation record and random-stream state are retained by the normal candidate-world day commit.
- Formula output and mapped Effects are validated before application. A missing result field or rejected Effect aborts the candidate day; no partial Effect is committed.

A Trigger may also emit one Mod-scoped Domain Event through the built-in `event.emit` Resolution:

```js
{
  triggers: [{
    id: "my-mod.publish-settlement-fact",
    due: { kind: "elapsed", days: 2 },
    event: {
      type: "event.emit",
      payload: {
        type: "settlement-finished",
        payload: {
          settlementId: "my-settlement",
          outcome: "accepted"
        }
      }
    }
  }]
}
```

The Engine uses the Trigger owner as the source Mod and writes the resulting fact as:
- `type`: `mod.<owner-mod-id>.<event-type>` (underscores in the Mod ID are represented as hyphens in this type);
- `scope`: `mod`;
- `subjectId`: the original owner Mod ID;
- `payload`: the supplied object fields plus Engine-owned `modId` and `eventType` fields.

The `event.emit` request accepts only `type` and optional object `payload`. It cannot choose another Mod's namespace, use a built-in Engine event namespace, supply an idempotency key or call a command/callback. The Resolution returns a Domain Event descriptor in its plan; Settlement does not write history. The Trigger runner appends the fact to the candidate world before it writes `trigger.resolved`, and records the emitted fact's ID, sequence and type in that resolution record. A pending Domain Event Trigger matching the new fact is activated for the next completed campaign day, not recursively executed in the current one.

Resolution plans contain a JSON-safe result object, at most 16 Effect descriptors and at most 16 Domain Event descriptors. The Effect executor applies Effects in listed order. The Trigger runner appends the approved planned Domain Events and then emits `trigger.resolved`. All records and state changes commit with the candidate day. A failed Resolution, Effect or event write discards the candidate day.

Trigger IDs are stable across saves and retries. Re-submitting the same ID with the same definition is ignored while its pending entry or recent receipt is retained. Reusing the ID with a different definition fails validation. The Engine retains the latest 256 Trigger receipts, so this is a bounded replay fence, not a permanent global identity ledger.

The due sources currently are:
- `{ kind: "date", date: "YYYY-MM-DD" }`: a valid campaign calendar date strictly after the current date.
- `{ kind: "elapsed", days: N }`: a positive integer number of completed campaign days.
- `{ kind: "domain-event", type: "market.prices-settled", scope: "market", subjectId: "my-market" }`: wait for one newly recorded Domain Event with the exact type and any supplied exact filters. `scope` and `subjectId` are optional; no payload expression or wildcard matcher is provided.

A Domain Event Trigger listens only for facts recorded **after the Trigger is scheduled**. It does not scan or replay the retained Domain Event history, and it does not backfill a fact that already occurred. When a new matching fact is appended to the candidate world, the Engine captures its immutable JSON-safe snapshot on the pending Trigger and sets its due day to the next completed campaign day. The snapshot is retained with the Trigger and its receipt, so later pruning of the bounded Domain Event history cannot erase the source fact.

All due sources are processed only at whole-day boundaries; fractional day progress does not run Trigger actions. The Engine processes Triggers that were already due immediately after advancing the campaign clock, before `campaign.before-day` and before annual/monthly/weekly/daily simulation systems. A Domain Event emitted during a day therefore cannot recursively settle its Trigger on that same boundary. Triggers created later during settlement can first run on a subsequent completed day.

A System Event is a transient internal processing request, not a player-facing narrative event and not a Domain Event. Its optional `sourceEvent` carries the fact that activated a Domain Event Trigger. It is resolved inside the candidate-world day transaction. The read-only Event Bus still receives completed Domain Event facts only after the whole world commits; it is not used as the Trigger execution channel. If a resolution or Effect fails, the candidate day—including effects, event records, queue removal and receipt—is discarded.

The built-in Resolutions currently are `effect.apply`, `formula.effect` and `event.emit`. Condition/threshold Trigger sources, Command Resolution, a generic numeric modifier language, temporary-effect lifecycle management, random result pools and Presentation/UI are not yet implemented. API v3 data-only Mods remain unaffected.

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

The approved Effects currently perform **immediate state transitions**. They do not create active, stackable or source-tracked modifier instances that can later be removed. A `*.delta` Effect is not automatically reversible: applying an inverse delta at expiry is unsafe when values are clamped or other changes occur in between. Timed/persistent modifier lifecycle management is not implemented.

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
| mod.state.increment | key, delta | Adds to a numeric value in this Mod's own saved namespace; an absent key starts at 0, while an existing key must contain a finite number (`null` is not treated as absent) |
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
- Up to 128 Effects, 64 custom events and 32 Triggers per hook invocation. Calculation records are separately bounded.
- Inline JSON remains forbidden in Mod INI.
- Symlinked package files and undeclared JavaScript files are rejected.

Do not make a long-running loop, schedule background work or perform asynchronous I/O inside a hook. A hook is called only by the simulation at its declared point.

## Capability and trust boundary

Hooks receive no Node require, process, module, exports, network fetch, timers, filesystem handle, Electron API, DOM object or mutable engine service. Global Date and Math.random are disabled; use the deterministic `api.random(scope)` helper (scope defaults to `default`).

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


## Mod-defined financial initialization

Fresh-world finance is defined by Mod content. A currency has a stable content ID, a public currency code and a minor-unit precision. Financial accounts reference the currency content ID and declare their owner, opening balance and overdraft policy.

    [currency.credits]
    code = "CR"
    minor_unit_digits = 2
    name_key = currency.cr.name

    [financial_account.player-main]
    owner_type = player
    owner_id = free-haven-league
    currency_id = credits
    opening_balance_minor = 25000000
    overdraft_limit_minor = 0
    allow_negative = false
    status = open
    name_key = finance.account.player.name

Opening balances must balance to zero per currency. The Engine provides integer-minor-unit accounting, balanced transaction execution, account validation and transfer mechanics; currency names, starting accounts, opening balances and owner categories are Mod content. The legacy CR/player-main opening ledger is retained only as a migration adapter for old saves and is not used to create new worlds.

## Mod-defined formulas and recurring simulation systems

API v4 Mods may declare versioned formulas and recurring systems. These are **game behaviour owned by the Mod**; the Engine still owns the calculation recorder, schedule registry, dependency checks, deterministic invocation boundary, Effect execution and atomic settlement.

Formula declarations use the [formulas] section. Each target is script-file.js:functionName:version:

    [files]
    scripts = simulation.js

    [formulas]
    economy.example-price = simulation.js:calculateExamplePrice:1

A formula function receives an input object with inputs, day and randomScope, plus api. It returns an object result. The helper API includes deterministic random(scope), recordStep and recordModifier. Formula ID/version and the full input/result trace are recorded by the Engine calculation service. A Trigger's formula.effect may reference only a formula registered by an enabled Mod; the Engine supplies no built-in gameplay formulas.

Recurring system declarations use the [systems] section. Values use cadence:order:dependencies:hook-id; dependencies are semicolon-separated system IDs, or - when there are none. The Engine prefixes each local system ID with the owning Mod ID.

    [hooks]
    my-mod.simulation.daily = simulation.js:onDailySimulation

    [systems]
    daily-update = daily:20:-:my-mod.simulation.daily

Supported cadence names are annual, monthly, weekly, daily and manual. Order and dependency resolution are handled by the Engine's generic registry. A system hook receives a detached snapshot containing day, date, systemId, world and the serializable Mod catalog.

A system hook may return effects, events, triggers and calculations. Effects are still restricted to the Engine's approved transition API. Events may optionally specify scope and subjectId; their type is namespaced to the owning Mod. Calculation entries are bounded JSON records and are appended to the normal calculation audit. No Mod may return an arbitrary world patch or register a raw Engine callback.

API v3 remains INI-only and cannot declare scripts, hooks, formulas or simulation systems. The required Core package may use API v4 scripts for actual baseline gameplay behaviour; those scripts are Mod content, not Engine implementation.
