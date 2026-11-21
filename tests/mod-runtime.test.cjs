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
      colonyOne: { id: "colonyOne", population: 100, stability: 50, stockpiles: { ore: 10 } }
    },
    markets: { marketOne: { id: "marketOne", prices: { ore: 5 } } },
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
  assert.equal(world.colonies.colonyOne.stability, 52);
  assert.equal(world.colonies.colonyOne.stockpiles.ore, 13);
  assert.equal(world.markets.marketOne.prices.ore, 10);
  assert.equal(world.fleets.fleetOne.readiness, 75);
  assert.equal(world.fleets.fleetOne.morale, 75);
  assert.equal(world.wars.warOne.warWeariness.factionOne, 14);
  assert.equal(world.domainEvents.length, 8);
  assert.equal(world.domainEvents.at(-1).type, "mod.test-mod.monthly-note");
  assert.ok(world.domainEvents.every((event) => event.idempotencyKey));
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
  for (let day = 0; day < 30; day += 1) advanceDay(world, compiled.catalog);

  const report = world.domainEvents.find((event) => event.type === "mod.example-market.monthly-market-observation");
  assert.ok(report);
  assert.deepEqual(report.payload, { day: 30, marketCount: 3, quoteCount: 9 });
});
