"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  createModExtensionRuntime,
  applyModHookResults
} = require("../engine/mod-runtime.cjs");
const { createDomainEventEmitter } = require("../engine/domain-events.cjs");
const { readModPackages } = require("../electron/mod-loader.cjs");
const { compileCatalog } = require("../engine/catalog.cjs");
const { createPopulationGroups } = require("../engine/population.cjs");
const { createWorld, advanceDay } = require("../engine/simulation.cjs");

function mod(source, hook = "campaign.after-day", handler = "onHook", id = "test-mod") {
  return {
    id,
    enabled: true,
    scripts: { "hooks.js": source },
    hooks: { [hook]: "hooks.js:" + handler }
  };
}

test("executes declared hooks with deterministic input and a small pure helper API", () => {
  const runtime = createModExtensionRuntime([mod(
    "function onHook(input, api) { return { events: [{ type: 'sample', payload: { day: input.day, roll: api.random(), processType: typeof process, requireType: typeof require, fetchType: typeof fetch, dateType: typeof Date, globalRandomType: typeof Math.random } }] }; }"
  )]);
  const first = runtime.run("campaign.after-day", { day: 12 });
  const second = runtime.run("campaign.after-day", { day: 12 });
  assert.deepEqual(first, second);
  assert.equal(first[0].events[0].payload.day, 12);
  assert.equal(first[0].events[0].payload.processType, "undefined");
  assert.equal(first[0].events[0].payload.requireType, "undefined");
  assert.equal(first[0].events[0].payload.fetchType, "undefined");
  assert.equal(first[0].events[0].payload.dateType, "undefined");
  assert.equal(first[0].events[0].payload.globalRandomType, "undefined");
});

test("separates deterministic random sequences by entity scope and freezes hook input", () => {
  const scoped = createModExtensionRuntime([mod(
    "function onHook(input, api) { return { events: [{ type: 'roll', payload: { roll: api.random(), globalRandomType: typeof globalThis.Math.random } }] }; }"
  )]);
  const firstA = scoped.run("campaign.after-day", { day: 5 }, { randomScope: "colony-a" });
  const secondA = scoped.run("campaign.after-day", { day: 5 }, { randomScope: "colony-a" });
  const firstB = scoped.run("campaign.after-day", { day: 5 }, { randomScope: "colony-b" });
  assert.deepEqual(firstA, secondA);
  assert.notEqual(firstA[0].events[0].payload.roll, firstB[0].events[0].payload.roll);
  assert.equal(firstA[0].events[0].payload.globalRandomType, "undefined");

  const mutation = createModExtensionRuntime([mod(
    "function onHook(input) { input.day = 99; return {}; }"
  )]);
  assert.throws(() => mutation.run("campaign.after-day", { day: 5 }), { code: "MOD_HOOK_FAILURE" });
});

test("injects only each Mod's own saved state, not the global state table", () => {
  const runtime = createModExtensionRuntime([mod(
    "function onHook(input) { return { events: [{ type: 'state-check', payload: { ownValue: input.modState.counter, globalTableType: typeof input.world.modState } }] }; }"
  )]);
  const outcomes = runtime.run("campaign.after-day", {
    day: 7,
    world: { modState: { "test-mod": { counter: 4 }, "other-mod": { secret: 99 } } }
  }, {
    randomScope: "world",
    modStateById: { "test-mod": { counter: 4 }, "other-mod": { secret: 99 } }
  });
  assert.equal(outcomes[0].events[0].payload.ownValue, 4);
  assert.equal(outcomes[0].events[0].payload.globalTableType, "undefined");
});

test("applies bounded persistent Mod state set, increment and delete effects", () => {
  const world = { modState: {}, clock: { day: 2, date: "2478-04-03" }, domainEventSequence: 0, domainEvents: [] };
  const catalog = { commodities: new Map(), securities: new Map() };
  const emitDomainEvent = createDomainEventEmitter(world, world.clock);
  const first = applyModHookResults([{
    modId: "test-mod",
    effects: [
      { type: "mod.state.set", payload: { key: "phase", value: "opening" } },
      { type: "mod.state.increment", payload: { key: "turns", delta: 3 } },
      { type: "mod.state.increment", payload: { key: "turns", delta: 2 } }
    ],
    events: []
  }], { world, catalog, day: 2, hookId: "campaign.after-day", emitDomainEvent });
  assert.equal(first.effectCount, 3);
  assert.deepEqual(world.modState["test-mod"], { phase: "opening", turns: 5 });

  applyModHookResults([{
    modId: "test-mod",
    effects: [{ type: "mod.state.delete", payload: { key: "phase" } }],
    events: []
  }], { world, catalog, day: 2, hookId: "campaign.after-day", subjectKey: "cleanup", emitDomainEvent });
  assert.deepEqual(world.modState["test-mod"], { turns: 5 });
});

test("runs multiple Mods in stable ID order rather than folder enumeration order", () => {
  const make = (id) => mod(
    "function onHook() { return { events: [{ type: 'ran', payload: { mod: '" + id + "' } }] }; }",
    "campaign.after-day",
    "onHook",
    id
  );
  const runtime = createModExtensionRuntime([make("zeta-mod"), make("alpha-mod")]);
  assert.deepEqual(runtime.run("campaign.after-day", { day: 1 }).map((item) => item.modId), ["alpha-mod", "zeta-mod"]);
});

test("rejects undeclared handlers, host access and dynamically generated code", () => {
  const missing = createModExtensionRuntime([mod("function anotherName() { return {}; }")]);
  assert.throws(() => missing.run("campaign.after-day", { day: 1 }), { code: "MOD_HOOK_FAILURE" });

  const hostAccess = createModExtensionRuntime([mod(
    "function onHook() { process.exit(0); return {}; }"
  )]);
  assert.throws(() => hostAccess.run("campaign.after-day", { day: 1 }), { code: "MOD_HOOK_FAILURE" });

  const dynamicCode = createModExtensionRuntime([mod(
    "function onHook() { Function('return 1')(); return {}; }"
  )]);
  assert.throws(() => dynamicCode.run("campaign.after-day", { day: 1 }), { code: "MOD_HOOK_FAILURE" });
});

test("enforces execution timeouts and bounded output contracts", () => {
  const infinite = createModExtensionRuntime([mod("function onHook() { while (true) {} }")], { timeoutMs: 10 });
  assert.throws(() => infinite.run("campaign.after-day", { day: 1 }), { code: "MOD_HOOK_FAILURE" });

  const invalid = createModExtensionRuntime([mod(
    "function onHook() { return { effects: [{ type: 'world.write-anything', payload: {} }] }; }"
  )]);
  const result = invalid.run("campaign.after-day", { day: 1 });
  const world = { clock: { day: 1, date: "2478-04-02" }, domainEventSequence: 0, domainEvents: [] };
  const catalog = { commodities: new Map(), securities: new Map() };
  const emit = createDomainEventEmitter(world, world.clock);
  assert.throws(() => applyModHookResults(result, {
    world, catalog, day: 1, hookId: "campaign.after-day", emitDomainEvent: emit
  }), /Unsupported Mod effect type/);
});

test("applies only registered colony, market, fleet and war effects and records their causes", () => {
  const world = {
    clock: { day: 1, date: "2478-04-02" },
    domainEventSequence: 0,
    domainEvents: [],
    colonies: {
      colonyOne: { id: "colonyOne", population: 100, populationGroups: createPopulationGroups(100), stability: 50, stockpiles: { ore: 10 } }
    },
    markets: { marketOne: { id: "marketOne", prices: { ore: 5 }, lastChanges: { ore: 0 } } },
    fleets: { fleetOne: { id: "fleetOne", readiness: 70, morale: 80 } },
    wars: {
      warOne: {
        id: "warOne", participants: ["factionOne", "factionTwo"],
        warWeariness: { factionOne: 10, factionTwo: 20 }
      }
    }
  };
  const catalog = {
    commodities: new Map([["ore", { id: "ore", basePrice: 5 }]]),
    securities: new Map()
  };
  const outcomes = [{
    modId: "test-mod",
    hookId: "campaign.after-day",
    effects: [
      { type: "colony.population.delta", payload: { colonyId: "colonyOne", delta: 5 } },
      { type: "colony.stability.delta", payload: { colonyId: "colonyOne", delta: 2 } },
      { type: "colony.stockpile.delta", payload: { colonyId: "colonyOne", commodityId: "ore", delta: 3 } },
      { type: "market.price.multiplier", payload: { marketId: "marketOne", instrumentId: "ore", multiplier: 2 } },
      { type: "fleet.readiness.delta", payload: { fleetId: "fleetOne", delta: 5 } },
      { type: "fleet.morale.delta", payload: { fleetId: "fleetOne", delta: -5 } },
      { type: "war.weariness.delta", payload: { warId: "warOne", factionId: "factionOne", delta: 4 } }
    ],
    events: [{ type: "monthly-note", payload: { note: "test" } }]
  }];
  const emitted = applyModHookResults(outcomes, {
    world, catalog, day: 1, hookId: "campaign.after-day",
    emitDomainEvent: createDomainEventEmitter(world, world.clock)
  });

  assert.deepEqual(emitted, { effectCount: 7, eventCount: 1 });
  assert.equal(world.colonies.colonyOne.population, 105);
  assert.equal(world.colonies.colonyOne.populationGroups.unclassified.population, 105);
  assert.equal(world.colonies.colonyOne.stability, 52);
  assert.equal(world.colonies.colonyOne.stockpiles.ore, 13);
  assert.equal(world.markets.marketOne.prices.ore, 10);
  assert.equal(world.markets.marketOne.lastChanges.ore, 100);
  assert.equal(world.fleets.fleetOne.readiness, 75);
  assert.equal(world.fleets.fleetOne.morale, 75);
  assert.equal(world.wars.warOne.warWeariness.factionOne, 14);
  assert.equal(world.domainEvents.length, 8);
  assert.equal(world.domainEvents.at(-1).type, "mod.test-mod.monthly-note");
  assert.ok(world.domainEvents.every((event) => event.idempotencyKey));
});

test("population delta effects remove people proportionally from existing groups", () => {
  const world = {
    clock: { day: 2, date: "2478-04-03" },
    domainEventSequence: 0,
    domainEvents: [],
    colonies: {
      colonyOne: {
        id: "colonyOne",
        population: 100,
        populationGroups: {
          "group-a": { id: "group-a", population: 60, dimensions: { profession: { miner: 1 } } },
          "group-b": { id: "group-b", population: 40, dimensions: { profession: { engineer: 1 } } }
        }
      }
    }
  };
  const outcomes = [{
    modId: "test-mod",
    effects: [{ type: "colony.population.delta", payload: { colonyId: "colonyOne", delta: -25 } }],
    events: []
  }];
  applyModHookResults(outcomes, {
    world,
    catalog: { commodities: new Map(), securities: new Map() },
    day: 2,
    hookId: "campaign.after-day",
    emitDomainEvent: createDomainEventEmitter(world, world.clock)
  });

  assert.equal(world.colonies.colonyOne.population, 75);
  assert.equal(world.colonies.colonyOne.populationGroups["group-a"].population, 45);
  assert.equal(world.colonies.colonyOne.populationGroups["group-b"].population, 30);
  assert.deepEqual(world.colonies.colonyOne.populationGroups["group-a"].dimensions, { profession: { miner: 1 } });
  assert.deepEqual(world.colonies.colonyOne.populationGroups["group-b"].dimensions, { profession: { engineer: 1 } });
});

test("applies population group split, merge and dimension effects with cause records", () => {
  const world = {
    clock: { day: 3, date: "2478-04-04" },
    domainEventSequence: 0,
    domainEvents: [],
    colonies: {
      colonyOne: {
        id: "colonyOne",
        population: 140,
        populationGroups: {
          workers: {
            id: "workers",
            population: 100,
            dimensions: {
              profession: { miner: 0.6, engineer: 0.4 },
              wealth_tier: { low: 1 }
            }
          },
          support: {
            id: "support",
            population: 40,
            dimensions: {
              profession: { engineer: 1 },
              wealth_tier: { low: 1 }
            }
          }
        }
      }
    }
  };
  const catalog = {
    commodities: new Map(),
    securities: new Map(),
    professions: new Map([["miner", { id: "miner" }], ["engineer", { id: "engineer" }]]),
    wealthTiers: new Map([["low", { id: "low" }]])
  };
  const emitted = applyModHookResults([{
    modId: "test-mod",
    effects: [
      {
        type: "colony.population.group.split",
        payload: {
          colonyId: "colonyOne",
          sourceGroupId: "workers",
          newGroupId: "specialists",
          population: 20,
          sourceDimensions: {
            profession: { miner: 0.5, engineer: 0.5 },
            wealth_tier: { low: 1 }
          },
          newDimensions: {
            profession: { miner: 1, engineer: 0 },
            wealth_tier: { low: 1 }
          }
        }
      },
      {
        type: "colony.population.group.merge",
        payload: { colonyId: "colonyOne", sourceGroupId: "support", targetGroupId: "workers" }
      },
      {
        type: "colony.population.group.dimension.set",
        payload: {
          colonyId: "colonyOne",
          groupId: "specialists",
          dimensionId: "capability",
          distribution: { trained: 0.8, untrained: 0.2 }
        }
      }
    ],
    events: []
  }], {
    world,
    catalog,
    day: 3,
    hookId: "campaign.after-day",
    emitDomainEvent: createDomainEventEmitter(world, world.clock)
  });

  assert.deepEqual(emitted, { effectCount: 3, eventCount: 0 });
  assert.equal(world.colonies.colonyOne.population, 140);
  assert.equal(world.colonies.colonyOne.populationGroups.workers.population, 120);
  assert.deepEqual(world.colonies.colonyOne.populationGroups.workers.dimensions.profession, {
    engineer: 2 / 3, miner: 1 / 3
  });
  assert.equal(world.colonies.colonyOne.populationGroups.specialists.population, 20);
  assert.deepEqual(world.colonies.colonyOne.populationGroups.specialists.dimensions.capability, {
    trained: 0.8, untrained: 0.2
  });
  assert.equal(Object.hasOwn(world.colonies.colonyOne.populationGroups, "support"), false);
  assert.equal(world.domainEvents.length, 3);
  assert.equal(world.domainEvents[0].type, "mod.effect-applied");
  assert.equal(world.domainEvents[0].payload.effectType, "colony.population.group.split");
  assert.deepEqual(world.domainEvents[0].payload.result.sourceDimensionsAfter, {
    profession: { miner: 0.5, engineer: 0.5 },
    wealth_tier: { low: 1 }
  });
  assert.deepEqual(world.domainEvents[0].payload.result.newDimensions, {
    profession: { miner: 1, engineer: 0 },
    wealth_tier: { low: 1 }
  });
  assert.equal(world.domainEvents[0].payload.result.newGroupId, "specialists");
  assert.equal(world.domainEvents[1].payload.effectType, "colony.population.group.merge");
  assert.deepEqual(world.domainEvents[1].payload.result.dimensions.profession, {
    engineer: 2 / 3, miner: 1 / 3
  });
  assert.equal(world.domainEvents[2].payload.effectType, "colony.population.group.dimension.set");
  assert.deepEqual(world.domainEvents[2].payload.result.before, null);
});

test("rejects group effects that reference unregistered profession categories", () => {
  const colony = {
    id: "colonyOne",
    population: 10,
    populationGroups: {
      workers: {
        id: "workers",
        population: 10,
        dimensions: { profession: { miner: 1 } }
      }
    }
  };
  const world = {
    clock: { day: 1, date: "2478-04-02" },
    domainEventSequence: 0,
    domainEvents: [],
    colonies: { colonyOne: colony }
  };
  const before = structuredClone(world);
  assert.throws(() => applyModHookResults([{
    modId: "test-mod",
    effects: [{
      type: "colony.population.group.dimension.set",
      payload: {
        colonyId: "colonyOne",
        groupId: "workers",
        dimensionId: "profession",
        distribution: { unregistered: 1 }
      }
    }],
    events: []
  }], {
    world,
    catalog: { professions: new Map(), wealthTiers: new Map() },
    day: 1,
    hookId: "campaign.after-day",
    emitDomainEvent: createDomainEventEmitter(world, { day: 1, date: "2478-04-02" })
  }), /missing profession/);
  assert.deepEqual(world, before);
});

test("refuses invalid targets, negative stockpiles and unlisted market instruments", () => {
  const world = {
    colonies: { colonyOne: { id: "colonyOne", population: 20, stability: 50, stockpiles: { ore: 1 } } },
    markets: { marketOne: { id: "marketOne", prices: { ore: 5 } } },
    fleets: {},
    wars: {}
  };
  const catalog = { commodities: new Map([["ore", { id: "ore", basePrice: 5 }]]), securities: new Map() };
  assert.throws(() => applyModHookResults([{
    modId: "test-mod", effects: [{ type: "colony.stockpile.delta", payload: { colonyId: "colonyOne", commodityId: "ore", delta: -2 } }], events: []
  }], { world, catalog, day: 1, hookId: "campaign.after-day", emitDomainEvent: () => {} }), /negative stockpile/);
  assert.throws(() => applyModHookResults([{
    modId: "test-mod", effects: [{ type: "market.price.multiplier", payload: { marketId: "marketOne", instrumentId: "missing", multiplier: 2 } }], events: []
  }], { world, catalog, day: 1, hookId: "campaign.after-day", emitDomainEvent: () => {} }), /unlisted instrument/);
});

test("runs the example Mod hook through real world day settlement", async () => {
  const modsDirectory = path.join(__dirname, "..", "mods");
  const mods = await readModPackages(modsDirectory);
  assert.equal(mods.find((item) => item.id === "example-market").error, undefined);
  const compiled = compileCatalog(mods);
  assert.equal(compiled.ok, true, compiled.error);
  assert.deepEqual(compiled.catalog.extensions.map((item) => item.id), ["example-market"]);

  const world = createWorld(compiled.catalog, { seed: 12345 });
  for (let day = 0; day < 60; day += 1) advanceDay(world, compiled.catalog);

  const reports = world.domainEvents.filter((event) => event.type === "mod.example-market.monthly-market-observation");
  assert.equal(reports.length, 2);
  assert.deepEqual(reports.map((event) => event.payload), [
    { day: 30, marketCount: 3, quoteCount: 15, previousMonths: 0, modId: "example-market", eventType: "monthly-market-observation" },
    { day: 60, marketCount: 3, quoteCount: 15, previousMonths: 1, modId: "example-market", eventType: "monthly-market-observation" }
  ]);
  assert.deepEqual(world.modState["example-market"], { "months-observed": 2 });
  assert.equal(world.schemaVersion, 8);
});


test("enabled Mod script source participates in the deterministic content fingerprint", async () => {
  const modsDirectory = path.join(__dirname, "..", "mods");
  const original = await readModPackages(modsDirectory);
  const first = compileCatalog(original);
  assert.equal(first.ok, true, first.error);

  const changed = structuredClone(original);
  changed.find((item) => item.id === "example-market").scripts["market-events.js"] += "\n// fingerprint change\n";
  const second = compileCatalog(changed);
  assert.equal(second.ok, true, second.error);
  assert.notEqual(first.catalog.contentHash, second.catalog.contentHash);
});

test("a failing Mod hook aborts the candidate day and preserves the previous world", async () => {
  const modsDirectory = path.join(__dirname, "..", "mods");
  const mods = await readModPackages(modsDirectory);
  const compiled = compileCatalog(mods);
  assert.equal(compiled.ok, true, compiled.error);
  const brokenCatalog = {
    ...compiled.catalog,
    extensions: [
      ...compiled.catalog.extensions,
      {
        id: "broken-hook",
        version: "1.0.0",
        scripts: { "failure.js": "function failDay() { while (true) {} }" },
        hooks: { "campaign.after-day": "failure.js:failDay" }
      }
    ]
  };
  const world = createWorld(brokenCatalog, { seed: "failed-mod-day" });
  const before = structuredClone(world);
  assert.throws(() => advanceDay(world, brokenCatalog), {
    code: "MOD_HOOK_FAILURE",
    modId: "broken-hook",
    hookId: "campaign.after-day"
  });
  assert.deepEqual(world, before);
});
