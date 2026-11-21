"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  readModPackages
} = require("../electron/mod-loader.cjs");
const { compileCatalog } = require("../engine/catalog.cjs");
const { createWorld, advanceDay } = require("../engine/simulation.cjs");
const {
  createWorldQueryRegistry,
  createDefaultWorldQueryRegistry
} = require("../engine/queries.cjs");

async function catalog() {
  const mods = await readModPackages(path.join(__dirname, "..", "mods"));
  const result = compileCatalog(mods);
  if (!result.ok) throw new Error(result.error);
  return result.catalog;
}

test("default world query registry exposes stable overview and entity projections", async () => {
  const definitions = await catalog();
  const world = createWorld(definitions, { seed: "query-test" });
  const queries = createDefaultWorldQueryRegistry();

  assert.deepEqual(queries.queryIds(), [
    "colony.summary",
    "faction.summary",
    "fleet.summary",
    "market.summary",
    "war.summary",
    "world.overview"
  ]);
  assert.deepEqual(queries.execute("world.overview", world, definitions), {
    universeId: definitions.universe.id,
    day: 0,
    date: definitions.universe.startDate,
    dayFraction: 0,
    factionCount: definitions.factions.size,
    colonyCount: definitions.colonies.size,
    marketCount: definitions.markets.size,
    fleetCount: definitions.fleets.size,
    activeWarCount: [...definitions.wars.keys()].filter((id) => world.wars[id].status === "active").length
  });

  const colony = queries.execute("colony.summary", world, definitions, { colonyId: "new-dawn-colony" });
  assert.equal(colony.id, "new-dawn-colony");
  assert.equal(colony.population, world.colonies["new-dawn-colony"].population);

  const market = queries.execute("market.summary", world, definitions, { marketId: "verdant-exchange" });
  assert.equal(market.id, "verdant-exchange");
  assert.ok(market.instruments.length > 0);

  const fleet = queries.execute("fleet.summary", world, definitions, { fleetId: [...definitions.fleets.keys()][0] });
  assert.equal(fleet.id, [...definitions.fleets.keys()][0]);
  assert.ok(Array.isArray(fleet.ships));

  const war = queries.execute("war.summary", world, definitions, { warId: [...definitions.wars.keys()][0] });
  assert.ok(Array.isArray(war.participants));

  const faction = queries.execute("faction.summary", world, definitions, {
    factionId: [...definitions.factions.keys()][0]
  });
  assert.ok(Array.isArray(faction.colonies));
  assert.ok(Array.isArray(faction.fleets));
});

test("query projections are detached and recursively read-only", async () => {
  const definitions = await catalog();
  const world = createWorld(definitions, { seed: "query-detach" });
  const queries = createDefaultWorldQueryRegistry();
  const result = queries.execute("colony.summary", world, definitions, { colonyId: "new-dawn-colony" });

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.stockpiles), true);
  assert.throws(() => {
    result.stockpiles.ore = 999999;
  }, TypeError);
  assert.notEqual(result.stockpiles.ore, 999999);
  assert.equal(world.colonies["new-dawn-colony"].stockpiles.ore, result.stockpiles.ore);

  advanceDay(world, definitions);
  const after = queries.execute("colony.summary", world, definitions, { colonyId: "new-dawn-colony" });
  assert.notEqual(after, result);
});

test("custom query IDs must be unique and queries reject invalid or unknown input", async () => {
  const registry = createWorldQueryRegistry([{
    id: "example.counter",
    run: ({ payload }) => ({ value: payload.value ?? 0 })
  }]);
  const world = { clock: { day: 0, date: "2478-04-01", dayFraction: 0 } };
  const catalog = { universe: { id: "test" } };
  assert.deepEqual(registry.execute("example.counter", world, catalog, { value: 4 }), { value: 4 });
  assert.throws(() => registry.register({
    id: "example.counter",
    run: () => ({})
  }), /Duplicate world query ID/);
  assert.throws(() => registry.execute("unknown.query", world, catalog), /Unknown world query/);
  assert.throws(() => registry.execute("example.counter", world, catalog, []), /payload must be an object/);
  assert.throws(() => createWorldQueryRegistry([{ id: "Bad ID", run: () => ({}) }]), /stable ID/);
});
