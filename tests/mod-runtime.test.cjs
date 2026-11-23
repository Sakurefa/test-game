"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  createModExtensionRuntime,
  applyModEffect,
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

test("API v4 Mod scripts can exactly match a population Tag from the detached colony snapshot", () => {
  const runtime = createModExtensionRuntime([mod(
    "function onHook(input, api) { const match = api.matchPopulationTag('colony-a', 'residents', 'tag.humanoid'); return { events: [{ type: 'population-match', payload: match }] }; }"
  )]);
  const input = {
    day: 4,
    world: {
      colonies: {
        "colony-a": {
          populationGroups: {
            residents: {
              id: "residents",
              population: 200,
              dimensions: { species: { human: 0.65, xenari: 0.35 } }
            }
          }
        }
      }
    },
    catalog: {
      populationTags: [{
        id: "tag.humanoid",
        dimensionId: "species",
        categoryIds: ["human"]
      }]
    }
  };
  const result = runtime.run("campaign.after-day", input);
  assert.deepEqual(result[0].events[0].payload, {
    groupId: "residents",
    dimensionId: "species",
    categoryIds: ["human"],
    dimensionPresent: true,
    matchedProportion: 0.65,
    matchedPopulation: 130
  });

  const unknownDimension = structuredClone(input);
  unknownDimension.world.colonies["colony-a"].populationGroups.residents.dimensions = {};
  const unknown = runtime.run("campaign.after-day", unknownDimension);
  assert.equal(unknown[0].events[0].payload.dimensionPresent, false);
  assert.equal(unknown[0].events[0].payload.matchedPopulation, null);

  assert.throws(() => runtime.run("campaign.after-day", {
    ...input,
    catalog: { populationTags: [] }
  }), { code: "MOD_HOOK_FAILURE" });
});

test("API v4 evaluates each population Need rule independently for one group", () => {
  const runtime = createModExtensionRuntime([mod(
    "function onHook(input, api) { " +
    "const lines = input.catalog.populationNeedRules.map(rule => " +
    "api.evaluatePopulationNeedRule('colony-a', 'residents', rule.id)); " +
    "return { events: [{ type: 'population-need-lines', payload: { lines } }] }; }"
  )]);
  const input = {
    day: 5,
    world: {
      colonies: {
        "colony-a": {
          populationGroups: {
            residents: {
              id: "residents",
              population: 200,
              dimensions: { species: { human: 0.65, xenari: 0.35 } }
            }
          }
        }
      }
    },
    catalog: {
      populationTags: [{
        id: "tag.humanoid",
        dimensionId: "species",
        categoryIds: ["human"]
      }],
      populationNeedRules: [
        {
          id: "need.food.base",
          populationTagId: "tag.humanoid",
          commodityId: "food",
          dailyNeedPerThousand: 0.25
        },
        {
          id: "need.food.extra",
          populationTagId: "tag.humanoid",
          commodityId: "food",
          dailyNeedPerThousand: 0.5
        }
      ]
    }
  };
  const result = runtime.run("campaign.after-day", input);
  assert.deepEqual(result[0].events[0].payload.lines, [
    {
      ruleId: "need.food.base",
      populationTagId: "tag.humanoid",
      groupId: "residents",
      commodityId: "food",
      dimensionId: "species",
      categoryIds: ["human"],
      dimensionPresent: true,
      matchedProportion: 0.65,
      matchedPopulation: 130,
      dailyNeedPerThousand: 0.25,
      requested: 0.0325
    },
    {
      ruleId: "need.food.extra",
      populationTagId: "tag.humanoid",
      groupId: "residents",
      commodityId: "food",
      dimensionId: "species",
      categoryIds: ["human"],
      dimensionPresent: true,
      matchedProportion: 0.65,
      matchedPopulation: 130,
      dailyNeedPerThousand: 0.5,
      requested: 0.065
    }
  ]);

  const unknown = structuredClone(input);
  unknown.world.colonies["colony-a"].populationGroups.residents.dimensions = {};
  const unknownResult = runtime.run("campaign.after-day", unknown);
  const unknownLines = unknownResult[0].events[0].payload.lines;
  assert.equal(unknownLines[0].dimensionPresent, false);
  assert.equal(unknownLines[0].matchedPopulation, null);
  assert.equal(unknownLines[0].requested, null);

  const missingRuleRuntime = createModExtensionRuntime([mod(
    "function onHook(input, api) { return { events: [{ type: 'missing-need-rule', payload: api.evaluatePopulationNeedRule('colony-a', 'residents', 'need.missing') }] }; }"
  )]);
  assert.throws(() => missingRuleRuntime.run("campaign.after-day", input), { code: "MOD_HOOK_FAILURE" });
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

test("Mod state increment treats missing keys as zero but rejects an explicitly null value", () => {
  const world = { modState: {}, clock: { day: 2, date: "2478-04-03" }, domainEventSequence: 0, domainEvents: [] };
  const catalog = { commodities: new Map(), securities: new Map() };
  const emitDomainEvent = createDomainEventEmitter(world, world.clock);

  applyModHookResults([{
    modId: "test-mod",
    effects: [{ type: "mod.state.set", payload: { key: "counter", value: null } }],
    events: []
  }], {
    world, catalog, day: 2, hookId: "campaign.after-day",
    subjectKey: "set-null-counter", emitDomainEvent
  });

  const beforeIncrement = structuredClone(world);
  assert.throws(() => applyModHookResults([{
    modId: "test-mod",
    effects: [{ type: "mod.state.increment", payload: { key: "counter", delta: 1 } }],
    events: []
  }], {
    world, catalog, day: 2, hookId: "campaign.after-day",
    subjectKey: "increment-null-counter", emitDomainEvent
  }), /non-numeric existing value/);

  assert.deepEqual(world, beforeIncrement);
  assert.equal(world.modState["test-mod"].counter, null);
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
      { type: "market.price.multiplier", payload: { marketId: "marketOne", instrumentId: "ore", multiplier: 20 } },
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

  assert.deepEqual(emitted, { effectCount: 7, eventCount: 1, triggerCount: 0, calculationCount: 0 });
  assert.equal(world.colonies.colonyOne.population, 105);
  assert.equal(world.colonies.colonyOne.populationGroups.unclassified.population, 105);
  assert.equal(world.colonies.colonyOne.stability, 52);
  assert.equal(world.colonies.colonyOne.stockpiles.ore, 13);
  assert.equal(world.markets.marketOne.prices.ore, 100);
  assert.equal(world.markets.marketOne.lastChanges.ore, 1900);
  assert.equal(world.fleets.fleetOne.readiness, 75);
  assert.equal(world.fleets.fleetOne.morale, 75);
  assert.equal(world.wars.warOne.warWeariness.factionOne, 14);
  assert.equal(world.domainEvents.length, 8);
  assert.equal(world.domainEvents.at(-1).type, "mod.test-mod.monthly-note");
  assert.ok(world.domainEvents.every((event) => event.idempotencyKey));
});

test("applies a Mod-selected stockpile allocation without imposing an Engine fairness rule", () => {
  const world = { colonies: { colonyOne: { id: "colonyOne", stockpiles: { food: 10, water: 3 } } } };
  const catalog = { commodities: new Map([["food", { id: "food" }], ["water", { id: "water" }]]) };
  const result = applyModEffect({
    type: "colony.stockpile.allocate",
    payload: {
      colonyId: "colonyOne",
      requests: [
        { id: "food.group-a", requesterId: "group-a", commodityId: "food", requested: 8 },
        { id: "food.group-b", requesterId: "group-b", commodityId: "food", requested: 6 },
        { id: "water.group-a", requesterId: "group-a", commodityId: "water", requested: 2 }
      ],
      // Deliberately unequal shares: the Engine applies the Mod's legal policy unchanged.
      allocations: [
        { requestId: "food.group-a", allocated: 8 },
        { requestId: "food.group-b", allocated: 2 },
        { requestId: "water.group-a", allocated: 1.5 }
      ]
    }
  }, world, catalog, "test-mod");
  assert.deepEqual(result.requests, [
    { id: "food.group-a", requesterId: "group-a", commodityId: "food", requested: 8, allocated: 8, unmet: 0, satisfaction: 1 },
    { id: "food.group-b", requesterId: "group-b", commodityId: "food", requested: 6, allocated: 2, unmet: 4, satisfaction: 2 / 6 },
    { id: "water.group-a", requesterId: "group-a", commodityId: "water", requested: 2, allocated: 1.5, unmet: 0.5, satisfaction: 0.75 }
  ]);
  assert.deepEqual(result.stockpileChanges, [
    { commodityId: "food", before: 10, allocated: 10, after: 0 },
    { commodityId: "water", before: 3, allocated: 1.5, after: 1.5 }
  ]);
  assert.deepEqual(world.colonies.colonyOne.stockpiles, { food: 0, water: 1.5 });
});

test("rejects invalid stockpile allocation plans without partially changing inventory", () => {
  const validPayload = {
    colonyId: "colonyOne",
    requests: [
      { id: "food.a", requesterId: "group-a", commodityId: "food", requested: 4 },
      { id: "food.b", requesterId: "group-b", commodityId: "food", requested: 4 }
    ],
    allocations: [
      { requestId: "food.a", allocated: 2 },
      { requestId: "food.b", allocated: 2 }
    ]
  };
  const invalidPlans = [
    {
      payload: {
        ...validPayload,
        requests: [...validPayload.requests, validPayload.requests[0]],
        allocations: [...validPayload.allocations, { requestId: "food.a", allocated: 0 }]
      },
      message: /duplicate request ID/
    },
    { payload: { ...validPayload, allocations: [{ requestId: "food.a", allocated: 2 }, { requestId: "unknown", allocated: 2 }] }, message: /unknown request/ },
    { payload: { ...validPayload, allocations: [{ requestId: "food.a", allocated: 2 }, { requestId: "food.a", allocated: 1 }] }, message: /duplicate result/ },
    { payload: { ...validPayload, allocations: [{ requestId: "food.a", allocated: 2 }] }, message: /matching bounded/ },
    { payload: { ...validPayload, allocations: [{ requestId: "food.a", allocated: -1 }, { requestId: "food.b", allocated: 2 }] }, message: /cannot be negative/ },
    { payload: { ...validPayload, allocations: [{ requestId: "food.a", allocated: 5 }, { requestId: "food.b", allocated: 0 }] }, message: /exceeds requested quantity/ },
    { payload: { ...validPayload, allocations: [{ requestId: "food.a", allocated: 4 }, { requestId: "food.b", allocated: 4 }] }, message: /exceeds available inventory/ }
  ];
  for (const invalid of invalidPlans) {
    const world = { colonies: { colonyOne: { id: "colonyOne", stockpiles: { food: 6 } } } };
    const before = structuredClone(world);
    assert.throws(() => applyModEffect({
      type: "colony.stockpile.allocate", payload: invalid.payload
    }, world, { commodities: new Map([["food", { id: "food" }]]) }, "test-mod"), invalid.message);
    assert.deepEqual(world, before);
  }
});

test("rejects competing stockpile allocation plans for one colony before applying hook effects", () => {
  const world = {
    clock: { day: 1, date: "2478-04-02" }, domainEventSequence: 0, domainEvents: [],
    colonies: { colonyOne: { id: "colonyOne", stockpiles: { food: 10 }, stability: 50 } }
  };
  const plan = {
    type: "colony.stockpile.allocate",
    payload: {
      colonyId: "colonyOne",
      requests: [{ id: "food.a", requesterId: "group-a", commodityId: "food", requested: 5 }],
      allocations: [{ requestId: "food.a", allocated: 5 }]
    }
  };
  const before = structuredClone(world);
  assert.throws(() => applyModHookResults([
    { modId: "test-mod-a", effects: [plan], events: [] },
    { modId: "test-mod-b", effects: [{ ...plan, payload: structuredClone(plan.payload) }], events: [] }
  ], {
    world, catalog: { commodities: new Map([["food", { id: "food" }]]), securities: new Map() },
    day: 1, hookId: "campaign.after-day",
    emitDomainEvent: createDomainEventEmitter(world, world.clock)
  }), /only one stockpile allocation plan per colony/);
  assert.deepEqual(world, before);
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

  assert.deepEqual(emitted, { effectCount: 3, eventCount: 0, triggerCount: 0, calculationCount: 0 });
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
  }), /references missing .* profession/);
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

  const world = createWorld(compiled.catalog, { seed: 12345 });
  for (let day = 0; day < 30; day += 1) advanceDay(world, compiled.catalog);

  const firstReport = world.domainEvents.find((event) =>
    event.type === "mod.example-market.monthly-market-observation" && event.day === 30
  );
  assert.ok(firstReport);
  assert.deepEqual(firstReport.payload, {
    day: 30, marketCount: 3, quoteCount: 15, previousMonths: 0,
    modId: "example-market", eventType: "monthly-market-observation"
  });

  for (let day = 30; day < 60; day += 1) advanceDay(world, compiled.catalog);

  const secondReport = world.domainEvents.find((event) =>
    event.type === "mod.example-market.monthly-market-observation" && event.day === 60
  );
  assert.ok(secondReport);
  assert.deepEqual(secondReport.payload, {
    day: 60, marketCount: 3, quoteCount: 15, previousMonths: 1,
    modId: "example-market", eventType: "monthly-market-observation"
  });
  assert.deepEqual(world.modState["example-market"], { "months-observed": 2 });
  assert.equal(world.schemaVersion, 9);
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
