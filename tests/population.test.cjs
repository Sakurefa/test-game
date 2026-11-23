"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPopulationGroups,
  getPopulationTotal,
  validatePopulationGroups,
  matchPopulationDimensionCategories,
  applyPopulationDelta,
  applyPopulationGroupSplit,
  applyPopulationGroupMerge,
  applyPopulationGroupDimensionSet
} = require("../engine/population.cjs");

test("population total is calculated from group counts, not a separately maintained number", () => {
  const groups = {
    workers: { id: "workers", population: 80, dimensions: {} },
    dependants: { id: "dependants", population: 20, dimensions: {} }
  };
  assert.equal(getPopulationTotal(groups), 100);
  assert.equal(getPopulationTotal({ unclassified: { id: "unclassified", population: 0, dimensions: {} } }), 0);
});

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

test("matches Mod-defined race categories using their explicit share in one population dimension", () => {
  const group = {
    id: "residents",
    population: 200,
    dimensions: {
      species: { human: 0.65, xenari: 0.35 },
      social_class: { citizen: 0.8, noble: 0.2 }
    }
  };

  assert.deepEqual(matchPopulationDimensionCategories(group, "species", ["xenari"]), {
    groupId: "residents",
    dimensionId: "species",
    categoryIds: ["xenari"],
    dimensionPresent: true,
    matchedProportion: 0.35,
    matchedPopulation: 70
  });
  assert.deepEqual(matchPopulationDimensionCategories(group, "social_class", ["noble"]), {
    groupId: "residents",
    dimensionId: "social_class",
    categoryIds: ["noble"],
    dimensionPresent: true,
    matchedProportion: 0.2,
    matchedPopulation: 40
  });
});

test("OR-matches multiple mutually exclusive categories within one dimension", () => {
  const group = {
    id: "residents",
    population: 100,
    dimensions: { species: { human: 0.4, xenari: 0.35, avian: 0.25 } }
  };
  const result = matchPopulationDimensionCategories(group, "species", ["human", "avian"]);
  assert.equal(result.matchedProportion, 0.65);
  assert.equal(result.matchedPopulation, 65);
  assert.throws(() => matchPopulationDimensionCategories(group, "species", ["human", "human"]), /duplicate category ID/);
});

test("does not invent a population share when the requested dimension is absent", () => {
  const group = { id: "unclassified", population: 80, dimensions: {} };
  assert.deepEqual(matchPopulationDimensionCategories(group, "species", ["human"]), {
    groupId: "unclassified",
    dimensionId: "species",
    categoryIds: ["human"],
    dimensionPresent: false,
    matchedProportion: null,
    matchedPopulation: null
  });
});

test("rejects invalid dimension and category selectors", () => {
  const group = { id: "residents", population: 10, dimensions: { species: { human: 1 } } };
  assert.throws(() => matchPopulationDimensionCategories(group, "", ["human"]), /valid dimension ID/);
  assert.throws(() => matchPopulationDimensionCategories(group, "species", []), /at least one category/);
  assert.throws(() => matchPopulationDimensionCategories(group, "species", ["Bad ID"]), /invalid category ID/);
});

test("population changes use group counts as source and refresh the scalar projection", () => {
  const colony = {
    id: "colony-one",
    population: 100,
    populationGroups: {
      workers: { id: "workers", population: 70, dimensions: {} },
      dependants: { id: "dependants", population: 30, dimensions: {} }
    }
  };
  assert.throws(() => applyPopulationDelta({ ...colony, population: 99 }, 1), /projection does not match/);
  assert.deepEqual(colony.populationGroups, {
    workers: { id: "workers", population: 70, dimensions: {} },
    dependants: { id: "dependants", population: 30, dimensions: {} }
  });
  applyPopulationDelta(colony, 15);
  assert.equal(colony.populationGroups.workers.population + colony.populationGroups.dependants.population
    + colony.populationGroups.unclassified.population, colony.population);
  assert.equal(colony.population, 115);
  assert.equal(getPopulationTotal(colony.populationGroups), colony.population);
});

test("positive population deltas enter the unclassified group without changing existing groups", () => {
  const colony = {
    id: "colony-one",
    population: 100,
    populationGroups: {
      workers: { id: "workers", population: 100, dimensions: { profession: { miner: 1 } } }
    }
  };
  assert.deepEqual(applyPopulationDelta(colony, 25), {
    before: 100,
    after: 125,
    delta: 25,
    groupChanges: [{ groupId: "unclassified", before: 0, after: 25 }]
  });
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

function createSplitColony() {
  return {
    id: "colony-one",
    population: 100,
    populationGroups: {
      workers: {
        id: "workers",
        population: 100,
        dimensions: {
          profession: { miner: 0.6, engineer: 0.4 },
          wealth_tier: { low: 1 }
        }
      }
    }
  };
}

test("splits a group proportionally without changing colony population or its marginal dimensions", () => {
  const colony = createSplitColony();
  const result = applyPopulationGroupSplit(colony, {
    sourceGroupId: "workers",
    newGroupId: "specialists",
    population: 20
  });

  assert.equal(colony.population, 100);
  assert.equal(colony.populationGroups.workers.population, 80);
  assert.equal(colony.populationGroups.specialists.population, 20);
  assert.deepEqual(colony.populationGroups.specialists.dimensions, colony.populationGroups.workers.dimensions);
  assert.deepEqual(result, {
    colonyId: "colony-one",
    sourceGroupId: "workers",
    newGroupId: "specialists",
    sourcePopulationBefore: 100,
    sourcePopulationAfter: 80,
    newGroupPopulation: 20,
    sourceDimensionsAfter: {
      profession: { miner: 0.6, engineer: 0.4 },
      wealth_tier: { low: 1 }
    },
    newDimensions: {
      profession: { miner: 0.6, engineer: 0.4 },
      wealth_tier: { low: 1 }
    }
  });
  assert.equal(validatePopulationGroups(colony.populationGroups, colony.population), true);
});

test("dimension-aware split requires both resulting distributions and conserves each marginal category count", () => {
  const colony = createSplitColony();
  applyPopulationGroupSplit(colony, {
    sourceGroupId: "workers",
    newGroupId: "miners",
    population: 20,
    sourceDimensions: {
      profession: { miner: 0.5, engineer: 0.5 },
      wealth_tier: { low: 1 }
    },
    newDimensions: {
      profession: { miner: 1, engineer: 0 },
      wealth_tier: { low: 1 }
    }
  });

  assert.equal(colony.populationGroups.workers.population, 80);
  assert.deepEqual(colony.populationGroups.workers.dimensions.profession, { miner: 0.5, engineer: 0.5 });
  assert.deepEqual(colony.populationGroups.miners.dimensions.profession, { miner: 1, engineer: 0 });
  assert.equal(colony.population, 100);
});

test("rejects non-conserving splits and leaves the original colony untouched", () => {
  const colony = createSplitColony();
  const before = structuredClone(colony);
  assert.throws(() => applyPopulationGroupSplit(colony, {
    sourceGroupId: "workers",
    newGroupId: "miners",
    population: 20,
    sourceDimensions: {
      profession: { miner: 0.4, engineer: 0.6 },
      wealth_tier: { low: 1 }
    },
    newDimensions: {
      profession: { miner: 1, engineer: 0 },
      wealth_tier: { low: 1 }
    }
  }), /conserve category mass/);
  assert.deepEqual(colony, before);
});

test("rejects zero, excessive and duplicate group splits without mutating state", () => {
  const colony = createSplitColony();
  const before = structuredClone(colony);
  assert.throws(() => applyPopulationGroupSplit(colony, {
    sourceGroupId: "workers", newGroupId: "new-group", population: 0
  }), /must be positive/);
  assert.throws(() => applyPopulationGroupSplit(colony, {
    sourceGroupId: "workers", newGroupId: "new-group", population: 100
  }), /leave people/);
  assert.throws(() => applyPopulationGroupSplit(colony, {
    sourceGroupId: "workers", newGroupId: "workers", population: 10
  }), /different valid new group/);
  assert.deepEqual(colony, before);
});

test("merges groups by population-weighting each independent dimension and removes the source", () => {
  const colony = {
    id: "colony-one",
    population: 100,
    populationGroups: {
      miners: {
        id: "miners", population: 60,
        dimensions: { profession: { miner: 1 }, wealth_tier: { low: 1 } }
      },
      engineers: {
        id: "engineers", population: 40,
        dimensions: { profession: { engineer: 1 }, wealth_tier: { high: 1 } }
      }
    }
  };
  const result = applyPopulationGroupMerge(colony, {
    sourceGroupId: "engineers",
    targetGroupId: "miners"
  });

  assert.deepEqual(Object.keys(colony.populationGroups), ["miners"]);
  assert.equal(colony.populationGroups.miners.population, 100);
  assert.deepEqual(colony.populationGroups.miners.dimensions, {
    profession: { engineer: 0.4, miner: 0.6 },
    wealth_tier: { high: 0.4, low: 0.6 }
  });
  assert.equal(colony.population, 100);
  assert.deepEqual(result.dimensions, colony.populationGroups.miners.dimensions);
  assert.equal(validatePopulationGroups(colony.populationGroups, colony.population), true);
});

test("rejects merges that would discard a dimension or merge a group into itself", () => {
  const colony = {
    id: "colony-one",
    population: 30,
    populationGroups: {
      source: { id: "source", population: 10, dimensions: { profession: { miner: 1 } } },
      target: { id: "target", population: 20, dimensions: {} }
    }
  };
  const before = structuredClone(colony);
  assert.throws(() => applyPopulationGroupMerge(colony, {
    sourceGroupId: "source", targetGroupId: "target"
  }), /dimension sets match/);
  assert.throws(() => applyPopulationGroupMerge(colony, {
    sourceGroupId: "source", targetGroupId: "source"
  }), /different valid group IDs/);
  assert.deepEqual(colony, before);
});

test("sets one group's dimension without changing any population count", () => {
  const colony = createSplitColony();
  const result = applyPopulationGroupDimensionSet(colony, {
    groupId: "workers",
    dimensionId: "capability",
    distribution: { trained: 0.35, untrained: 0.65 }
  });
  assert.equal(colony.population, 100);
  assert.equal(colony.populationGroups.workers.population, 100);
  assert.deepEqual(colony.populationGroups.workers.dimensions.capability, {
    trained: 0.35, untrained: 0.65
  });
  assert.equal(result.before, null);
  assert.deepEqual(result.after, colony.populationGroups.workers.dimensions.capability);
});

test("rejects invalid dimension replacement without mutating state", () => {
  const colony = createSplitColony();
  const before = structuredClone(colony);
  assert.throws(() => applyPopulationGroupDimensionSet(colony, {
    groupId: "workers",
    dimensionId: "profession",
    distribution: { miner: 0.5, engineer: 0.3 }
  }), /proportions must total 1/);
  assert.deepEqual(colony, before);
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
