import test from "node:test";
import assert from "node:assert/strict";
import { getRecentCalculationRecords } from "../src/calculation-audit.mjs";

test("calculation inspector selects newest records first without mutating saved audit history", () => {
  const world = { audit: { calculations: [
    { day: 1, formulaId: "economy.commodity-price" },
    { day: 2, formulaId: "economy.security-price" },
    { day: 3, formulaId: "economy.commodity-price" }
  ] } };
  const before = structuredClone(world);
  assert.deepEqual(getRecentCalculationRecords(world, 2), [world.audit.calculations[2], world.audit.calculations[1]]);
  assert.deepEqual(world, before);
});

test("calculation inspector handles missing history and rejects invalid limits", () => {
  assert.deepEqual(getRecentCalculationRecords({}), []);
  assert.deepEqual(getRecentCalculationRecords({ audit: { calculations: [] } }), []);
  assert.throws(() => getRecentCalculationRecords({}, 0), /positive integer/);
});
