"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPopulationGroups,
  validatePopulationGroups,
  applyPopulationDelta
} = require("../engine/population.cjs");

test("creates one neutral group without choosing game-specific population categories", () => {
  assert.deepEqual(createPopulationGroups(125.5), {
    unclassified: { id: "unclassified", population: 125.5, dimensions: {} }
  });
  assert.throws(() => createPopulationGroups(-1), /finite non-negative/);
});

test("validates separate statistical dimensions without requiring a joint distribution", () => {
  const groups = {
    workers: {
      id: "workers",
      population: 80,
      dimensions: {
        profession: { miner: 0.25, engineer: 0.75 },
        wealth_tier: { unclassified: 1 }
      }
    },
    dependants: {
      id: "dependants",
      population: 20,
      dimensions: {
        profession: { unassigned: 1 },
        wealth_tier: { poor: 0.6, middle: 0.4 }
      }
    }
  };
  assert.equal(validatePopulationGroups(groups, 100), true);
});

test("rejects invalid group identities, totals and dimension proportions", () => {
  const valid = createPopulationGroups(100);
  assert.throws(() => validatePopulationGroups(valid, 101), /does not match/);

  const badIdentity = { ...valid, wrong: { id: "different", population: 100, dimensions: {} } };
  delete badIdentity.unclassified;
  assert.throws(() => validatePopulationGroups(badIdentity, 100), /identity/);

  const badDistribution = {
    group: { id: "group", population: 100, dimensions: { profession: { miner: 0.6, engineer: 0.3 } } }
  };
  assert.throws(() => validatePopulationGroups(badDistribution, 100), /proportions must total 1/);
});

test("positive population deltas enter the unclassified group without changing existing groups", () => {
  const colony = {
    id: "colony-one",
    population: 100,
    populationGroups: {
      workers: { id: "workers", population: 100, dimensions: { profession: { miner: 1 } } }
    }
  };
  assert.deepEqual(applyPopulationDelta(colony, 25), { before: 100, after: 125, delta: 25 });
  assert.equal(colony.population, 125);
  assert.equal(colony.populationGroups.workers.population, 100);
  assert.deepEqual(colony.populationGroups.unclassified, {
    id: "unclassified", population: 25, dimensions: {}
  });
});

test("negative population deltas reduce all existing groups proportionally", () => {
  const colony = {
    id: "colony-one",
    population: 100,
    populationGroups: {
      "group-a": { id: "group-a", population: 60, dimensions: { profession: { miner: 1 } } },
      "group-b": { id: "group-b", population: 40, dimensions: { profession: { engineer: 1 } } }
    }
  };
  applyPopulationDelta(colony, -25);
  assert.equal(colony.population, 75);
  assert.equal(colony.populationGroups["group-a"].population, 45);
  assert.equal(colony.populationGroups["group-b"].population, 30);
  assert.equal(validatePopulationGroups(colony.populationGroups, colony.population), true);
});

test("rejects a population reduction below zero without mutating the colony", () => {
  const colony = {
    id: "colony-one",
    population: 10,
    populationGroups: createPopulationGroups(10)
  };
  const before = structuredClone(colony);
  assert.throws(() => applyPopulationDelta(colony, -10.01), /below zero/);
  assert.deepEqual(colony, before);
});
