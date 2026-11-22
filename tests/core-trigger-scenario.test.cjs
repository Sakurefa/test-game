"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { readModPackages } = require("../electron/mod-loader.cjs");
const {
  compileCatalog, createWorld, advanceDay, validateWorldState
} = require("../engine/index.cjs");
const {
  initializeStorage, createSaveSlot, writeGameState, readGameStateWithReceipt
} = require("../electron/storage.cjs");

test("optional Trigger Test Mod runs every current Trigger, Resolution and Effect through real daily settlement and save restore", async (t) => {
  const modsRoot = path.join(__dirname, "..", "mods");
  const mods = await readModPackages(modsRoot, { enabledMods: { "trigger-test": true } });
  const testMod = mods.find((mod) => mod.id === "trigger-test");
  assert.ok(testMod, "Trigger Test Mod is present");
  assert.equal(testMod.error, undefined);
  assert.equal(testMod.apiVersion, 4);

  const compiled = compileCatalog(mods);
  assert.equal(compiled.ok, true, compiled.error);
  const catalog = compiled.catalog;
  const world = createWorld(catalog, { seed: "trigger-test-full-run" });
  const initialPopulation = world.colonies["new-dawn-colony"].population;
  const initialStability = world.colonies["new-dawn-colony"].stability;
  const initialOre = world.colonies["new-dawn-colony"].stockpiles.ore;
  const initialReadiness = world.fleets["helios-border-fleet"].readiness;
  const initialMorale = world.fleets["helios-border-fleet"].morale;
  const initialWeariness = world.wars["cinder-conflict"].warWeariness["helios-compact"];

  advanceDay(world, catalog);

  const stateAfterDayOne = world.modState["trigger-test"];
  assert.ok(stateAfterDayOne);
  assert.equal(stateAfterDayOne["trigger-test-delete-me"], "temporary");
  assert.equal(world.triggerQueue.pending.length, 17);
  const marketListener = world.triggerQueue.pending.find((item) => item.id === "trigger-test.16-market-event-react");
  const modListener = world.triggerQueue.pending.find((item) => item.id === "trigger-test.17-mod-event-react");
  assert.equal(marketListener.sourceEvent.type, "market.prices-settled");
  assert.equal(marketListener.sourceEvent.subjectId, "new-dawn-market");
  assert.equal(modListener.sourceEvent, null);

  advanceDay(world, catalog);

  const stateAfterDayTwo = world.modState["trigger-test"];
  assert.ok(["route-a", "route-b"].includes(stateAfterDayTwo["trigger-test-selection"]));
  assert.equal(stateAfterDayTwo["trigger-test-runs"], 1);
  assert.equal(stateAfterDayTwo["trigger-test-delete-me"], undefined);
  assert.equal(stateAfterDayTwo["trigger-test-date-runs"], 1);
  assert.equal(stateAfterDayTwo["trigger-test-elapsed-runs"], 1);
  assert.equal(stateAfterDayTwo["trigger-test-market-event-runs"], 1);
  assert.equal(typeof stateAfterDayTwo["trigger-test-formula-price"], "number");
  assert.ok(world.domainEvents.some((event) =>
    event.type === "mod.trigger-test.trigger-test-signal"
      && event.payload.choice === stateAfterDayTwo["trigger-test-selection"]
  ));

  const resolvedDayTwo = world.domainEvents
    .filter((event) => event.type === "trigger.resolved" && event.day === 2)
    .map((event) => event.subjectId);
  for (const id of [
    "trigger-test.01-state-set",
    "trigger-test.02-state-increment",
    "trigger-test.03-state-delete",
    "trigger-test.04-population-delta",
    "trigger-test.05-population-split",
    "trigger-test.08-stability",
    "trigger-test.09-stockpile",
    "trigger-test.10-market-price",
    "trigger-test.11-fleet-readiness",
    "trigger-test.12-fleet-morale",
    "trigger-test.13-war-weariness",
    "trigger-test.14-formula-effect",
    "trigger-test.15-event-emit",
    "trigger-test.16-market-event-react",
    "trigger-test.18-date",
    "trigger-test.19-elapsed"
  ]) assert.ok(resolvedDayTwo.includes(id), "day two resolved " + id);

  const colonyAfterDayTwo = world.colonies["new-dawn-colony"];
  assert.equal(colonyAfterDayTwo.population, initialPopulation + 1);
  assert.equal(colonyAfterDayTwo.stability, initialStability + 1);
  assert.equal(colonyAfterDayTwo.stockpiles.ore, initialOre + 1);
  assert.equal(world.fleets["helios-border-fleet"].readiness, initialReadiness + 1);
  assert.equal(world.fleets["helios-border-fleet"].morale, initialMorale + 1);
  assert.equal(world.wars["cinder-conflict"].warWeariness["helios-compact"], initialWeariness + 1);
  assert.equal(colonyAfterDayTwo.populationGroups["trigger-test-group"].population, 1);
  const emittedListener = world.triggerQueue.pending.find((item) => item.id === "trigger-test.17-mod-event-react");
  assert.equal(emittedListener.sourceEvent.type, "mod.trigger-test.trigger-test-signal");
  assert.equal(emittedListener.dueDay, 3);
  assert.ok(world.triggerQueue.pending.some((item) => item.id === "trigger-test.06-population-merge"));
  assert.ok(world.triggerQueue.pending.some((item) => item.id === "trigger-test.07-population-dimension"));

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "trigger-test-save-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await initializeStorage(root);
  await createSaveSlot(root, "slot_trigger_test", "Trigger Test");
  await writeGameState(root, "slot_trigger_test", world);
  const restored = await readGameStateWithReceipt(root, "slot_trigger_test");
  assert.equal(restored.receipt.status, "verified");
  assert.deepEqual(restored.state.triggerQueue, world.triggerQueue);
  assert.equal(validateWorldState(restored.state, catalog), true);

  advanceDay(restored.state, catalog);

  const finalState = restored.state.modState["trigger-test"];
  assert.equal(finalState["trigger-test-emitted-event-runs"], 1);
  assert.deepEqual(
    restored.state.colonies["new-dawn-colony"].populationGroups.unclassified.dimensions["trigger-test"],
    finalState["trigger-test-selection"] === "route-a" ? { route_a: 1 } : { route_b: 1 }
  );
  assert.equal(restored.state.colonies["new-dawn-colony"].populationGroups["trigger-test-group"], undefined);
  assert.equal(restored.state.colonies["new-dawn-colony"].population, initialPopulation + 1);
  assert.equal(restored.state.triggerQueue.pending.length, 0);
  assert.equal(restored.state.triggerQueue.receipts.length, 19);
  assert.ok(restored.state.triggerQueue.receipts.some((item) =>
    item.id === "trigger-test.17-mod-event-react"
      && item.sourceEvent.type === "mod.trigger-test.trigger-test-signal"
  ));
  assert.equal(validateWorldState(restored.state, catalog), true);
});
