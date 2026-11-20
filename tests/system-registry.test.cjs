const test = require("node:test");
const assert = require("node:assert/strict");
const { createSystemRegistry } = require("../engine/system-registry.cjs");

test("registry resolves dependencies and runs daily and weekly systems once per day", () => {
  const log = [];
  const registry = createSystemRegistry([
    {
      id: "economy.market",
      cadence: "daily",
      dependsOn: ["colonies.production"],
      update: ({ day }) => log.push(`market:${day}`)
    },
    {
      id: "colonies.production",
      cadence: "weekly",
      update: ({ day }) => log.push(`production:${day}`)
    }
  ]);
  const world = { scheduler: { lastRunDayBySystem: {} } };
  for (let day = 1; day <= 14; day += 1) {
    registry.runDue({ world, day });
    registry.runDue({ world, day });
  }
  assert.deepEqual(log, [
    "market:1", "market:2", "market:3", "market:4", "market:5", "market:6",
    "production:7", "market:7", "market:8", "market:9", "market:10",
    "market:11", "market:12", "market:13", "production:14", "market:14"
  ]);
});

test("registry rejects missing dependencies, cycles and duplicate IDs", () => {
  assert.throws(() => createSystemRegistry([
    { id: "system.one", cadence: "daily", dependsOn: ["system.none"] }
  ]), /missing system/);
  assert.throws(() => createSystemRegistry([
    { id: "system.one", cadence: "daily", dependsOn: ["system.two"] },
    { id: "system.two", cadence: "daily", dependsOn: ["system.one"] }
  ]), /dependency cycle/);
  assert.throws(() => createSystemRegistry([
    { id: "system.one", cadence: "daily" },
    { id: "system.one", cadence: "weekly" }
  ]), /Duplicate/);
});

test("registry exposes lifecycle hooks in dependency order and disposes in reverse", () => {
  const log = [];
  const registry = createSystemRegistry([
    {
      id: "system.base", cadence: "manual",
      initialize: () => log.push("init-base"),
      save: () => ({ saved: true }),
      restore: (state) => log.push(`restore-base:${state.saved}`),
      dispose: () => log.push("dispose-base")
    },
    {
      id: "system.child", cadence: "manual", dependsOn: ["system.base"],
      initialize: () => log.push("init-child"),
      dispose: () => log.push("dispose-child")
    }
  ]);
  registry.initialize();
  const saved = registry.save();
  registry.restore(saved);
  registry.dispose();
  assert.deepEqual(log, [
    "init-base", "init-child", "restore-base:true", "dispose-child", "dispose-base"
  ]);
});

test("registry refuses asynchronous simulation updates", () => {
  const registry = createSystemRegistry([
    { id: "system.async", cadence: "daily", update: async () => {} }
  ]);
  assert.throws(() => registry.runDue({ world: {}, day: 1 }), /must be synchronous/);
});

test("manual systems run only through their explicit manual trigger", () => {
  const calls = [];
  const registry = createSystemRegistry([
    { id: "events.manual-check", cadence: "manual", update: ({ day, manual }) => calls.push({ day, manual }) }
  ]);
  const world = { clock: { day: 9 }, scheduler: { lastRunDayBySystem: {} } };
  assert.deepEqual(registry.runDue({ world, day: 9 }), []);
  registry.runManual({ world, id: "events.manual-check" });
  registry.runManual({ world, id: "events.manual-check" });
  assert.deepEqual(calls, [{ day: 9, manual: true }, { day: 9, manual: true }]);
  assert.throws(() => registry.runManual({ world, id: "missing.system" }), /Unknown simulation system/);
});

test("runtime update failures identify the exact simulation system node", () => {
  const registry = createSystemRegistry([{
    id: "economy.market-pricing",
    cadence: "daily",
    update: () => { throw new Error("required quote was missing"); }
  }]);
  const world = { scheduler: { lastRunDayBySystem: {} } };
  assert.throws(
    () => registry.runDue({ world, day: 1 }),
    (error) => error.code === "SIMULATION_SYSTEM_FAILURE"
      && error.message.includes("economy.market-pricing.update failed")
      && /required quote was missing/.test(error.message)
  );
});
