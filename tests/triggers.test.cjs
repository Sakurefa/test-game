"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readModPackages } = require("../electron/mod-loader.cjs");
const {
  compileCatalog, createWorld, advanceDay, applyPopulationDelta,
  createTriggerQueue, scheduleTrigger, processDueTriggers,
  createResolutionRegistry, validateWorldState
} = require("../engine/index.cjs");

function simpleRegistry() {
  return createResolutionRegistry([{
    id: "test.resolve",
    validate: ({ event }) => event.payload.value >= 0,
    resolve: ({ event }) => ({ result: { value: event.payload.value * 2 }, effects: [] })
  }]);
}

function triggerWorld() {
  return {
    clock: { date: "2480-02-28", day: 10 },
    triggerQueue: createTriggerQueue()
  };
}

test("date and elapsed Triggers share the campaign calendar and process in due order", () => {
  const world = triggerWorld();
  const resolutions = simpleRegistry();
  const catalog = { modIds: ["test-mod"] };
  scheduleTrigger(world, {
    id: "test-mod.elapsed",
    ownerId: "test-mod",
    due: { kind: "elapsed", days: 1 },
    event: { type: "test.resolve", payload: { value: 3 } }
  }, { resolutions, catalog });
  scheduleTrigger(world, {
    id: "test-mod.calendar",
    ownerId: "test-mod",
    due: { kind: "date", date: "2480-03-01" },
    event: { type: "test.resolve", payload: { value: 4 } }
  }, { resolutions, catalog });

  const emissions = [];
  const emit = (event) => { emissions.push(event); return event; };
  const applyEffect = () => { throw new Error("No Effects expected in this resolution test"); };
  world.clock = { day: 11, date: "2480-02-29" };
  assert.equal(processDueTriggers(world, {
    day: 11, date: "2480-02-29", catalog, resolutions, applyEffect, emitDomainEvent: emit
  }).length, 1);
  assert.equal(world.triggerQueue.pending[0].id, "test-mod.calendar");
  world.clock = { day: 12, date: "2480-03-01" };
  assert.equal(processDueTriggers(world, {
    day: 12, date: "2480-03-01", catalog, resolutions, applyEffect, emitDomainEvent: emit
  }).length, 1);
  assert.equal(world.triggerQueue.pending.length, 0);
  assert.deepEqual(world.triggerQueue.receipts.map((item) => item.id), ["test-mod.elapsed", "test-mod.calendar"]);
  assert.deepEqual(emissions.map((item) => item.payload.resolution.value), [6, 8]);
  world.clock = { day: 12, date: "2480-03-01" };
  assert.equal(scheduleTrigger(world, {
    id: "test-mod.calendar",
    ownerId: "test-mod",
    due: { kind: "date", date: "2480-03-01" },
    event: { type: "test.resolve", payload: { value: 4 } }
  }, { resolutions, catalog }).duplicate, true);
});

test("Resolution rejects malformed plans and caps the number of planned Effects", () => {
  const event = { type: "test.plan", payload: {} };
  const missingEffects = createResolutionRegistry([{
    id: "test.plan",
    resolve: () => ({ result: {} })
  }]);
  assert.throws(() => missingEffects.resolve(event), /result, effects/);

  const tooMany = createResolutionRegistry([{
    id: "test.plan",
    resolve: () => ({
      result: {},
      effects: Array.from({ length: 17 }, () => ({ type: "test.effect", payload: {} }))
    })
  }]);
  assert.throws(() => tooMany.resolve(event), /cannot return more than 16 effects/);

  const malformedEffect = createResolutionRegistry([{
    id: "test.plan",
    resolve: () => ({ result: {}, effects: [{ type: "test.effect", payload: {}, extra: true }] })
  }]);
  assert.throws(() => malformedEffect.resolve(event), /invalid Effect descriptor/);
});

test("Trigger scheduling is idempotent for identical IDs and rejects conflicting reuse", () => {
  const world = triggerWorld();
  const resolutions = simpleRegistry();
  const catalog = { modIds: ["test-mod"] };
  const definition = {
    id: "test-mod.once",
    ownerId: "test-mod",
    due: { kind: "elapsed", days: 2 },
    event: { type: "test.resolve", payload: { value: 5 } }
  };
  assert.equal(scheduleTrigger(world, definition, { resolutions, catalog }).duplicate, false);
  assert.equal(scheduleTrigger(world, structuredClone(definition), { resolutions, catalog }).duplicate, true);
  assert.throws(() => scheduleTrigger(world, {
    ...definition,
    event: { type: "test.resolve", payload: { value: 6 } }
  }, { resolutions, catalog }), /different definition/);
  assert.throws(() => scheduleTrigger(world, {
    ...definition, id: "another-mod.once"
  }, { resolutions, catalog }), /namespaced/);
  assert.throws(() => scheduleTrigger(world, {
    ...definition, due: { kind: "date", date: "2480-02-28" }
  }, { resolutions, catalog }), /after the current campaign date/);
});

async function loadCatalogWithTriggerHook(id, source) {
  const mods = await readModPackages(path.join(__dirname, "..", "mods"));
  const compiled = compileCatalog(mods);
  if (!compiled.ok) throw new Error(compiled.error);
  const script = typeof source === "function" ? source(compiled.catalog) : source;
  const extension = {
    id,
    version: "1.0.0",
    scripts: { "trigger-test.js": script },
    hooks: { "campaign.before-day": "trigger-test.js:onBeforeDay" }
  };
  return {
    ...compiled.catalog,
    extensions: [...compiled.catalog.extensions, extension],
    modIds: [...compiled.catalog.modIds, id]
  };
}

const schedulingHook = [
  "function onBeforeDay(input) {",
  "  if (input.day !== 1) return {};",
  "  return { triggers: [{",
  '    id: "test-trigger.delayed-effect",',
  '    due: { kind: "elapsed", days: 1 },',
  '    event: { type: "effect.apply", payload: { effect: {',
  '      type: "colony.stability.delta",',
  '      payload: { colonyId: "new-dawn-colony", delta: 5 }',
  "    } } }",
  "  }] };",
  "}"
].join("\n");

test("Mod hook schedules a persisted System Event that applies an approved Effect on a later day", async () => {
  const catalog = await loadCatalogWithTriggerHook("test-trigger", schedulingHook);
  const world = createWorld(catalog, { seed: "trigger-integration" });
  const initialStability = world.colonies["new-dawn-colony"].stability;
  advanceDay(world, catalog);
  assert.equal(world.triggerQueue.pending.length, 1);
  assert.equal(world.triggerQueue.pending[0].dueDay, 2);
  assert.equal(world.colonies["new-dawn-colony"].stability, initialStability);

  advanceDay(world, catalog);
  assert.equal(world.triggerQueue.pending.length, 0);
  assert.equal(world.triggerQueue.receipts.length, 1);
  assert.equal(world.colonies["new-dawn-colony"].stability, initialStability + 5);
  assert.equal(world.domainEvents.some((item) => item.type === "trigger.resolved"), true);
  assert.equal(validateWorldState(world, catalog), true);
});

const failingHook = [
  "function onBeforeDay(input) {",
  "  if (input.day !== 1) return {};",
  "  return { triggers: [{",
  '    id: "test-trigger.population-change",',
  '    due: { kind: "elapsed", days: 1 },',
  '    event: { type: "effect.apply", payload: { effect: {',
  '      type: "colony.population.delta",',
  '      payload: { colonyId: "new-dawn-colony", delta: -50 }',
  "    } } }",
  "  }] };",
  "}"
].join("\n");

const formulaHookFactory = (catalog) => {
  const market = [...catalog.markets.values()].find((item) => item.commodityIds?.length > 0);
  if (!market) throw new Error("Trigger formula test requires a market with a commodity");
  const instrumentId = market.commodityIds[0];
  const commodity = catalog.commodities.get(instrumentId);
  const literal = (value) => JSON.stringify(value);
  return [
    "function onBeforeDay(input) {",
    "  if (input.day !== 1) return {};",
    `  const market = input.world.markets[${literal(market.id)}];`,
    `  const colony = input.world.colonies[${literal(market.colonyId)}];`,
    "  return { triggers: [{",
    '    id: "test-trigger.formula-price_with_underscore",',
    '    due: { kind: "elapsed", days: 1 },',
    '    event: { type: "formula.effect", payload: {',
    '      formulaId: "economy.commodity-price",',
    "      inputs: {",
    `        basePrice: ${literal(commodity.basePrice)},`,
    `        targetStock: ${literal(commodity.targetStock)},`,
    `        stock: colony.stockpiles[${literal(instrumentId)}] || 0,`,
    `        priceElasticity: ${literal(commodity.priceElasticity)},`,
    `        volatility: ${literal(commodity.volatility)},`,
    `        previousPrice: market.prices[${literal(instrumentId)}]`,
    "      },",
    "      effects: [{",
    '        type: "mod.state.set",',
    '        payload: { key: "calculated-price" },',
    '        resultFields: { value: "price" }',
    "      }]",
    "    } }",
    "  }] };",
    "}"
  ].join("\n");
};

test("formula Resolution calculates a result plan before the Effect executor mutates Mod state", async () => {
  const catalog = await loadCatalogWithTriggerHook("test-trigger", formulaHookFactory);
  const world = createWorld(catalog, { seed: "trigger-formula-effect" });
  const market = [...catalog.markets.values()].find((item) => item.commodityIds?.length > 0);
  const instrumentId = market.commodityIds[0];
  const scheduledStock = world.colonies[market.colonyId].stockpiles[instrumentId] || 0;
  const scheduledPrice = world.markets[market.id].prices[instrumentId];

  advanceDay(world, catalog);
  assert.equal(world.triggerQueue.pending.length, 1);
  assert.equal(world.modState["test-trigger"]?.["calculated-price"], undefined);

  advanceDay(world, catalog);
  assert.equal(world.triggerQueue.pending.length, 0);
  assert.equal(world.triggerQueue.receipts.length, 1);

  const resolved = world.domainEvents.find((item) => item.type === "trigger.resolved"
    && item.subjectId === "test-trigger.formula-price_with_underscore");
  assert.ok(resolved);
  assert.equal(resolved.payload.resolution.formulaId, "economy.commodity-price");
  const calculatedPrice = resolved.payload.resolution.output.price;
  assert.equal(world.modState["test-trigger"]["calculated-price"], calculatedPrice);
  assert.equal(resolved.payload.effects.length, 1);
  assert.equal(resolved.payload.effects[0].effectType, "mod.state.set");
  assert.equal(resolved.payload.effects[0].result.after, calculatedPrice);

  const effectFact = world.domainEvents.find((item) => item.type === "mod.effect-applied"
    && item.payload.triggerId === "test-trigger.formula-price_with_underscore");
  assert.ok(effectFact);
  assert.equal(effectFact.payload.result.after, calculatedPrice);
  const formulaRecord = world.audit.calculations.find((record) => record.day === 2
    && record.formulaId === "economy.commodity-price"
    && record.result.price === calculatedPrice);
  assert.ok(formulaRecord);
  assert.equal(formulaRecord.inputs.stock, scheduledStock);
  assert.equal(formulaRecord.inputs.previousPrice, scheduledPrice);
  const triggerId = "test-trigger.formula-price_with_underscore";
  const expectedStreamId = "t" + triggerId[0] + Array.from(triggerId.slice(1),
    (character) => character.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  assert.ok(Object.hasOwn(world.rng.streams, expectedStreamId));
  assert.equal(validateWorldState(world, catalog), true);
});

test("a missing formula result binding aborts the candidate day before applying any Effect", async () => {
  const invalidFactory = (catalog) => {
    const base = formulaHookFactory(catalog);
    return base.replace('resultFields: { value: "price" }', 'resultFields: { value: "missingField" }');
  };
  const catalog = await loadCatalogWithTriggerHook("test-trigger", invalidFactory);
  const world = createWorld(catalog, { seed: "trigger-formula-invalid-binding" });
  advanceDay(world, catalog);
  const before = structuredClone(world);

  assert.throws(() => advanceDay(world, catalog), /no field 'missingField'/);
  assert.deepEqual(world, before);
  assert.equal(world.triggerQueue.pending.length, 1);
  assert.equal(world.triggerQueue.receipts.length, 0);
});

test("a failed due Trigger leaves the live day, queue and prior world changes untouched", async () => {
  const catalog = await loadCatalogWithTriggerHook("test-trigger", failingHook);
  const world = createWorld(catalog, { seed: "trigger-atomicity" });
  advanceDay(world, catalog);
  const colony = world.colonies["new-dawn-colony"];
  applyPopulationDelta(colony, 10 - colony.population);
  const before = structuredClone(world);
  assert.throws(() => advanceDay(world, catalog), /negative|population/i);
  assert.deepEqual(world, before);
  assert.equal(world.clock.day, 1);
  assert.equal(world.triggerQueue.pending.length, 1);
  assert.equal(world.triggerQueue.receipts.length, 0);
  assert.equal(world.domainEvents.some((item) => item.type === "trigger.resolved"), false);
});
