const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readModPackages } = require("../electron/mod-loader.cjs");
const {
  SeededRandom, addDays, compileCatalog, createWorld, advanceDay,
  advanceDays, validateWorldState
} = require("../engine/index.cjs");

async function loadCatalog() {
  const mods = await readModPackages(path.join(__dirname, "..", "mods"));
  const result = compileCatalog(mods);
  if (!result.ok) throw new Error(result.error);
  return result.catalog;
}

test("game clock handles month boundaries and leap years", () => {
  assert.equal(addDays("2478-04-30", 1), "2478-05-01");
  assert.equal(addDays("2480-02-28", 1), "2480-02-29");
  assert.equal(addDays("2480-02-28", 2), "2480-03-01");
  assert.throws(() => addDays("2480-02-30", 1), /Invalid game date/);
});

test("seeded random generator can be resumed from a snapshot", () => {
  const first = new SeededRandom("frontier-test");
  const values = [first.next(), first.next(), first.next()];
  const snapshot = first.snapshot();
  const resumed = new SeededRandom(snapshot.seed, snapshot.state);
  assert.deepEqual([resumed.next(), resumed.next()], [first.next(), first.next()]);
  assert.notDeepEqual(values, [0, 0, 0]);
  assert.throws(() => first.int(5, 2), /bounds/);
});

test("core and optional Mod content compile into a registered multi-system catalog", async () => {
  const catalog = await loadCatalog();
  assert.equal(catalog.universe.name, "赫利俄斯边境");
  assert.equal(catalog.systems.size, 4);
  assert.equal(catalog.colonies.size, 3);
  assert.equal(catalog.fleets.size, 2);
  assert.equal(catalog.wars.size, 1);
  assert.ok(catalog.events.has("supply-rumor"));
  assert.ok(catalog.events.has("example-positive-news"));
});

test("catalog compilation rejects unresolved cross-system and production references", async () => {
  const mods = await readModPackages(path.join(__dirname, "..", "mods"));
  const core = mods.find((mod) => mod.id === "core");
  core.data.content["universe.json"].colonies[0].industries[0].recipeId = "missing-recipe";
  const result = compileCatalog(mods);
  assert.equal(result.ok, false);
  assert.match(result.error, /industry recipe/);
});

test("daily simulation produces goods, updates markets and advances active wars", async () => {
  const catalog = await loadCatalog();
  const world = createWorld(catalog, { seed: 42, createdAt: "2478-04-01T00:00:00.000Z" });
  const initialOre = world.colonies["new-dawn-colony"].stockpiles.ore;
  const initialFood = world.colonies["verdant-colony"].stockpiles.food;
  const initialPrice = world.markets["verdant-exchange"].prices.food;

  advanceDay(world, catalog);

  assert.equal(world.clock.date, "2478-04-02");
  assert.equal(world.clock.day, 1);
  assert.ok(world.colonies["new-dawn-colony"].stockpiles.ore > initialOre);
  assert.ok(world.colonies["verdant-colony"].stockpiles.food > initialFood);
  assert.notEqual(world.markets["verdant-exchange"].prices.food, initialPrice);
  assert.equal(world.wars["cinder-conflict"].daysActive, 16);
  assert.equal(world.events.at(-1).type, "daily-report");
});

test("the same seed and saved random state produce the same simulation", async () => {
  const catalog = await loadCatalog();
  const options = { seed: "repeatable-frontier", createdAt: "2478-04-01T00:00:00.000Z" };
  const first = createWorld(catalog, options);
  const second = createWorld(catalog, options);
  advanceDays(first, catalog, 7);
  advanceDays(second, catalog, 7);
  assert.deepEqual(first, second);

  const resumed = JSON.parse(JSON.stringify(first));
  advanceDays(first, catalog, 3);
  advanceDays(resumed, catalog, 3);
  assert.deepEqual(first, resumed);
  assert.equal(validateWorldState(resumed, catalog), true);
});

test("simulation rejects oversized time jumps and saves made with mismatched content", async () => {
  const catalog = await loadCatalog();
  const world = createWorld(catalog, { seed: 7 });
  assert.throws(() => advanceDays(world, catalog, 31), /between 1 and 30/);
  const changedContent = { ...catalog, contentHash: "different" };
  assert.throws(() => advanceDay(world, changedContent), /different Mod content/);
});
