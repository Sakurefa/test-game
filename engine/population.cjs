"use strict";

const POPULATION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const DIMENSION_SUM_TOLERANCE = 1e-9;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createPopulationGroups(population) {
  if (!Number.isFinite(population) || population < 0) {
    throw new TypeError("Initial population must be a finite non-negative number");
  }
  return {
    unclassified: {
      id: "unclassified",
      population,
      dimensions: {}
    }
  };
}

function validatePopulationGroups(groups, totalPopulation, label = "population") {
  if (!isRecord(groups) || Object.keys(groups).length === 0) {
    throw new Error(label + " has no population groups");
  }
  if (!Number.isFinite(totalPopulation) || totalPopulation < 0) {
    throw new Error(label + " has an invalid total population");
  }

  let groupTotal = 0;
  for (const [groupId, group] of Object.entries(groups)) {
    if (!POPULATION_ID_PATTERN.test(groupId) || !isRecord(group) || group.id !== groupId) {
      throw new Error(label + " has an invalid population group identity: " + groupId);
    }
    if (!Number.isFinite(group.population) || group.population < 0) {
      throw new Error(label + " has an invalid population count for group " + groupId);
    }
    if (!isRecord(group.dimensions)) {
      throw new Error(label + " has invalid dimensions for group " + groupId);
    }

    for (const [dimensionId, distribution] of Object.entries(group.dimensions)) {
      if (!POPULATION_ID_PATTERN.test(dimensionId) || !isRecord(distribution) || Object.keys(distribution).length === 0) {
        throw new Error(label + " has an invalid distribution for dimension " + dimensionId);
      }
      let proportionTotal = 0;
      for (const [categoryId, proportion] of Object.entries(distribution)) {
        if (!POPULATION_ID_PATTERN.test(categoryId) || !Number.isFinite(proportion)
          || proportion < 0 || proportion > 1) {
          throw new Error(label + " has an invalid proportion for " + dimensionId + "." + categoryId);
        }
        proportionTotal += proportion;
      }
      if (Math.abs(proportionTotal - 1) > DIMENSION_SUM_TOLERANCE) {
        throw new Error(label + " dimension proportions must total 1: " + dimensionId);
      }
    }

    groupTotal += group.population;
  }

  const tolerance = Math.max(1, Math.abs(totalPopulation)) * DIMENSION_SUM_TOLERANCE;
  if (!Number.isFinite(groupTotal) || Math.abs(groupTotal - totalPopulation) > tolerance) {
    throw new Error(label + " population group total does not match colony population");
  }
  return true;
}

function applyPopulationDelta(colony, delta) {
  if (!isRecord(colony)) throw new TypeError("A colony state is required");
  if (!Number.isFinite(delta)) throw new TypeError("Population delta must be finite");

  const before = colony.population;
  validatePopulationGroups(colony.populationGroups, before, "colony " + String(colony.id || "unknown"));
  const after = before + delta;
  if (!Number.isFinite(after)) throw new RangeError("Population delta exceeds the supported numeric range");
  if (after < 0) throw new RangeError("Mod effect cannot reduce population below zero: " + String(colony.id || "unknown"));
  if (delta === 0) return { before, after, delta };

  const entries = Object.entries(colony.populationGroups)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const nextGroups = Object.fromEntries(entries.map(([id, group]) => [id, { ...group }]));

  if (delta > 0) {
    if (Object.hasOwn(nextGroups, "unclassified")) {
      nextGroups.unclassified.population += delta;
    } else {
      nextGroups.unclassified = {
        id: "unclassified",
        population: delta,
        dimensions: {}
      };
    }
  } else {
    const factor = after / before;
    let assigned = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const [groupId, group] = entries[index];
      const population = index === entries.length - 1
        ? Math.max(0, after - assigned)
        : group.population * factor;
      nextGroups[groupId].population = population;
      assigned += population;
    }
  }

  validatePopulationGroups(nextGroups, after, "colony " + String(colony.id || "unknown"));
  colony.populationGroups = nextGroups;
  colony.population = after;
  return { before, after, delta };
}

module.exports = {
  createPopulationGroups,
  validatePopulationGroups,
  applyPopulationDelta
};
