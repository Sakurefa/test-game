import test from "node:test";
import assert from "node:assert/strict";
import { getRecentCalculationRecords, summarizeCalculationRecord } from "../src/calculation-audit.mjs";
import formulas from "../engine/formulas.cjs";
const { createCalculationService } = formulas;

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

test("commodity price explanation uses the recorded scarcity step and final quote", () => {
  const record = { formulaId: "economy.commodity-price",
    inputs: { stock: 35, targetStock: 100, previousPrice: 12 },
    steps: [{ id: "scarcity", value: 0.65 }], result: { price: 13.2, change: 10 } };
  const before = structuredClone(record);
  const summary = summarizeCalculationRecord(record);
  assert.equal(summary.kind, "commodity-price");
  assert.equal(summary.statusKey, "audit.status.stock_scarce");
  assert.equal(summary.facts.find((fact) => fact.labelKey === "audit.field.current_stock").value, 35);
  assert.equal(summary.facts.find((fact) => fact.labelKey === "audit.field.current_price").value, 13.2);
  assert.deepEqual(record, before);
});

test("commodity price explanation distinguishes surplus and balanced inventory", () => {
  const surplus = summarizeCalculationRecord({ formulaId: "economy.commodity-price", inputs: {},
    steps: [{ id: "scarcity", value: -0.4 }], result: {} });
  const balanced = summarizeCalculationRecord({ formulaId: "economy.commodity-price", inputs: {},
    steps: [{ id: "scarcity", value: 0 }], result: {} });
  assert.equal(surplus.statusKey, "audit.status.stock_surplus");
  assert.equal(balanced.statusKey, "audit.status.stock_balanced");
});

test("security price explanation reflects the recorded daily quote change", () => {
  const summary = summarizeCalculationRecord({ formulaId: "economy.security-price",
    inputs: { previousPrice: 100, outputValue: 250 }, result: { price: 101.25, change: 1.25 } });
  assert.equal(summary.statusKey, "audit.status.price_up");
  assert.equal(summary.facts.find((fact) => fact.labelKey === "audit.field.daily_change").value, 1.25);
});

test("production explanation exposes existing inputs, throughput and settlement without recalculation", () => {
  const record = {
    formulaId: "economy.colony-production",
    inputs: { level: 2, stability: 75, recipeInputs: [{ commodityId: "water", quantity: 2, available: 1 }],
      recipeOutputs: [{ commodityId: "food", quantity: 8 }] },
    result: { efficiency: 0.75, requestedBatches: 1.5, batchScale: 0.5, limitingInput: "water",
      consumed: { water: 1 }, produced: { food: 4 } }
  };
  const before = structuredClone(record);
  const summary = summarizeCalculationRecord(record);
  assert.equal(summary.statusKey, "audit.status.production_limited");
  assert.equal(summary.limitingInput, "water");
  assert.deepEqual(summary.consumed, { water: 1 });
  assert.deepEqual(summary.produced, { food: 4 });
  assert.equal(summary.inputs[0].available, 1);
  assert.deepEqual(record, before);
});

test("production explanation marks zero output and input-free production accurately", () => {
  const empty = summarizeCalculationRecord({ formulaId: "economy.colony-production", inputs: { recipeInputs: [] },
    result: { efficiency: 1, requestedBatches: 2, batchScale: 0, limitingInput: "ore", consumed: {}, produced: {} } });
  const extraction = summarizeCalculationRecord({ formulaId: "economy.colony-production", inputs: { recipeInputs: [] },
    result: { efficiency: 1, requestedBatches: 2, batchScale: 2, limitingInput: null, consumed: {}, produced: { ore: 26 } } });
  assert.equal(empty.statusKey, "audit.status.no_output");
  assert.equal(extraction.statusKey, "audit.status.production_normal");
});

test("unknown calculation formulas keep a safe generic explanation", () => {
  const summary = summarizeCalculationRecord({ formulaId: "future.formula" });
  assert.equal(summary.kind, "unknown");
  assert.equal(summary.titleKey, "audit.formula.unknown");
});

test("Engine calculation registry starts empty and accepts explicitly registered Mod formulas", () => {
  const service = createCalculationService();
  assert.deepEqual(service.listDefinitions(), []);
  assert.throws(() => service.evaluate("economy.population-needs", {}), /Unknown calculation formula/);

  const custom = createCalculationService({ definitions: [{
    id: "economy.population-needs",
    version: 2,
    calculate: ({ inputs, recordStep }) => {
      const requested = inputs.population / 1000 * inputs.rate;
      const consumed = Math.min(requested, inputs.available);
      const result = {
        requested,
        consumed,
        unmet: Math.max(0, requested - consumed),
        satisfaction: requested > 0 ? consumed / requested : 1
      };
      recordStep("requested", requested);
      recordStep("consumed", consumed);
      return result;
    }
  }] });
  const { result, record } = custom.evaluate("economy.population-needs", {
    population: 1450000, rate: .0015, available: 1
  }, { day: 3 });
  assert.ok(Math.abs(result.requested - 2.175) < 1e-12);
  assert.equal(result.consumed, 1);
  assert.ok(Math.abs(result.unmet - 1.175) < 1e-12);
  assert.equal(record.formulaId, "economy.population-needs");
  assert.equal(record.version, 2);
  assert.deepEqual(record.steps.map(step => step.id), ["requested", "consumed"]);
});

test("population needs explanation reports daily fulfillment and shortage amounts from a Mod trace", () => {
  const summary = summarizeCalculationRecord({
    formulaId: "economy.population-needs",
    inputs: { population: 1450000, requirements: [{ commodityId: "water", dailyNeedPerThousand: .0015, available: 1 }] },
    result: {
      requested: { water: 2.175 },
      consumed: { water: 1 },
      unmet: { water: 1.175 },
      satisfaction: { water: .4598 }
    }
  });
  assert.equal(summary.statusKey, "audit.status.needs_shortage");
  assert.equal(summary.needs[0].commodityId, "water");
  assert.equal(summary.needs[0].unmet, 1.175);
  assert.equal(summary.facts.find((fact) => fact.labelKey === "audit.field.shortage_count").value, 1);
});
