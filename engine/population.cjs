"use strict";

const POPULATION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const DIMENSION_SUM_TOLERANCE = 1e-9;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneDimensions(dimensions) {
  return Object.fromEntries(
    Object.entries(dimensions).map(([dimensionId, distribution]) => [dimensionId, { ...distribution }])
  );
}

function validateDimensionDistribution(dimensionId, distribution, label = "population") {
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
  return true;
}

function validateDimensions(dimensions, label = "population") {
  if (!isRecord(dimensions)) throw new Error(label + " has invalid dimensions");
  for (const [dimensionId, distribution] of Object.entries(dimensions)) {
    validateDimensionDistribution(dimensionId, distribution, label);
  }
  return true;
}

function sameDimensionSet(left, right) {
  const leftIds = Object.keys(left).sort();
  const rightIds = Object.keys(right).sort();
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

/**
 * Population groups are the authoritative counts. A colony total is only a
 * projection of these records and must never be used to reconstruct them
 * during ordinary runtime operations.
 */
function getPopulationTotal(groups) {
  if (!isRecord(groups) || Object.keys(groups).length === 0) {
    throw new Error("Population has no population groups");
  }
  let total = 0;
  for (const group of Object.values(groups)) {
    if (!isRecord(group) || !Number.isFinite(group.population) || group.population < 0) {
      throw new Error("Population contains an invalid group count");
    }
    total += group.population;
  }
  if (!Number.isFinite(total)) throw new RangeError("Population total exceeds the supported numeric range");
  return total;
}

function validatePopulationGroups(groups, expectedTotal, label = "population") {
  if (!isRecord(groups) || Object.keys(groups).length === 0) {
    throw new Error(label + " has no population groups");
  }

  let groupTotal = 0;
  for (const [groupId, group] of Object.entries(groups)) {
    if (!POPULATION_ID_PATTERN.test(groupId) || !isRecord(group) || group.id !== groupId) {
      throw new Error(label + " has an invalid population group identity: " + groupId);
    }
    if (!Number.isFinite(group.population) || group.population < 0) {
      throw new Error(label + " has an invalid population count for group " + groupId);
    }
    validateDimensions(group.dimensions, label + " group " + groupId);
    groupTotal += group.population;
  }

  if (!Number.isFinite(groupTotal)) {
    throw new RangeError(label + " population total exceeds the supported numeric range");
  }
  if (expectedTotal !== undefined) {
    if (!Number.isFinite(expectedTotal) || expectedTotal < 0) {
      throw new Error(label + " has an invalid population total projection");
    }
    const tolerance = Math.max(1, Math.abs(groupTotal)) * DIMENSION_SUM_TOLERANCE;
    if (Math.abs(groupTotal - expectedTotal) > tolerance) {
      throw new Error(label + " population group total does not match the expected total");
    }
  }
  return true;
}

function readColonyPopulation(colony) {
  if (!isRecord(colony)) throw new TypeError("A colony state is required");
  const label = "colony " + String(colony.id || "unknown");
  validatePopulationGroups(colony.populationGroups, undefined, label);
  const total = getPopulationTotal(colony.populationGroups);
  if (colony.population !== undefined) {
    if (!Number.isFinite(colony.population) || colony.population < 0) {
      throw new Error(label + " has an invalid population total projection");
    }
    const tolerance = Math.max(1, Math.abs(total)) * DIMENSION_SUM_TOLERANCE;
    if (Math.abs(colony.population - total) > tolerance) {
      throw new Error(label + " population projection does not match its groups");
    }
  }
  return total;
}

function writePopulationGroups(colony, groups) {
  validatePopulationGroups(groups);
  const total = getPopulationTotal(groups);
  colony.populationGroups = groups;
  colony.population = total;
  return total;
}

function createPopulationGroups(fallbackPopulation, definitions = []) {
  if (!Number.isFinite(fallbackPopulation) || fallbackPopulation < 0) {
    throw new TypeError("Initial fallback population must be a finite non-negative number");
  }
  if (!Array.isArray(definitions)) {
    throw new TypeError("Population group definitions must be an array");
  }
  if (definitions.length === 0) {
    return {
      unclassified: {
        id: "unclassified",
        population: fallbackPopulation,
        dimensions: {}
      }
    };
  }

  const groups = {};
  for (const definition of definitions) {
    if (!isRecord(definition) || typeof definition.id !== "string" || !POPULATION_ID_PATTERN.test(definition.id)) {
      throw new Error("Initial population group has an invalid ID");
    }
    if (Object.hasOwn(groups, definition.id)) {
      throw new Error("Duplicate initial population group: " + definition.id);
    }
    validateDimensions(definition.dimensions, "initial population group " + definition.id);
    groups[definition.id] = {
      id: definition.id,
      population: definition.population,
      dimensions: cloneDimensions(definition.dimensions)
    };
  }
  validatePopulationGroups(groups, undefined, "initial population");
  return groups;
}

function clonePopulationGroups(groups) {
  return Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, {
    id: group.id,
    population: group.population,
    dimensions: cloneDimensions(group.dimensions)
  }]));
}

function assertDimensionMassConserved(before, sourceAfter, splitOut, beforePopulation, sourcePopulation, splitPopulation, groupId) {
  if (!sameDimensionSet(before, sourceAfter) || !sameDimensionSet(before, splitOut)) {
    throw new Error("Population group split cannot add or remove dimensions: " + groupId);
  }
  for (const dimensionId of Object.keys(before)) {
    const categoryIds = new Set([
      ...Object.keys(before[dimensionId]),
      ...Object.keys(sourceAfter[dimensionId]),
      ...Object.keys(splitOut[dimensionId])
    ]);
    for (const categoryId of categoryIds) {
      const beforeMass = beforePopulation * (before[dimensionId][categoryId] ?? 0);
      const afterMass = sourcePopulation * (sourceAfter[dimensionId][categoryId] ?? 0)
        + splitPopulation * (splitOut[dimensionId][categoryId] ?? 0);
      const tolerance = Math.max(1, Math.abs(beforeMass)) * DIMENSION_SUM_TOLERANCE;
      if (Math.abs(beforeMass - afterMass) > tolerance) {
        throw new Error("Population group split must conserve category mass: "
          + groupId + "." + dimensionId + "." + categoryId);
      }
    }
  }
}


/**
 * Selects population represented by one or more categories in one dimension.
 * Categories within that dimension are mutually exclusive (OR). This deliberately
 * does not combine independent dimensions or infer a joint distribution.
 */
function matchPopulationDimensionCategories(group, dimensionId, categoryIds) {
  if (!isRecord(group) || !Number.isFinite(group.population) || group.population < 0) {
    throw new TypeError("A population group with a finite non-negative count is required");
  }
  if (typeof dimensionId !== "string" || !POPULATION_ID_PATTERN.test(dimensionId)) {
    throw new TypeError("Population matching requires a valid dimension ID");
  }
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new TypeError("Population matching requires at least one category ID");
  }
  const seen = new Set();
  for (const categoryId of categoryIds) {
    if (typeof categoryId !== "string" || !POPULATION_ID_PATTERN.test(categoryId)) {
      throw new TypeError("Population matching contains an invalid category ID");
    }
    if (seen.has(categoryId)) throw new Error("Population matching contains a duplicate category ID: " + categoryId);
    seen.add(categoryId);
  }
  if (!isRecord(group.dimensions)) {
    throw new TypeError("Population group dimensions are missing or invalid");
  }

  const requestedCategories = [...categoryIds];
  const distribution = group.dimensions[dimensionId];
  if (distribution === undefined) {
    return {
      groupId: group.id,
      dimensionId,
      categoryIds: requestedCategories,
      dimensionPresent: false,
      matchedProportion: null,
      matchedPopulation: null
    };
  }

  validateDimensionDistribution(dimensionId, distribution, "population group " + String(group.id || "unknown"));
  let matchedProportion = 0;
  for (const categoryId of requestedCategories) {
    matchedProportion += distribution[categoryId] ?? 0;
  }
  if (!Number.isFinite(matchedProportion) || matchedProportion < 0
    || matchedProportion > 1 + DIMENSION_SUM_TOLERANCE) {
    throw new RangeError("Population dimension match exceeds the group's dimension share: " + dimensionId);
  }
  matchedProportion = Math.min(1, matchedProportion);
  return {
    groupId: group.id,
    dimensionId,
    categoryIds: requestedCategories,
    dimensionPresent: true,
    matchedProportion,
    matchedPopulation: group.population * matchedProportion
  };
}


function applyPopulationDelta(colony, delta) {
  if (!isRecord(colony)) throw new TypeError("A colony state is required");
  if (!Number.isFinite(delta)) throw new TypeError("Population delta must be finite");

  const before = readColonyPopulation(colony);
  const after = before + delta;
  if (!Number.isFinite(after)) throw new RangeError("Population delta exceeds the supported numeric range");
  if (after < 0) throw new RangeError("Mod effect cannot reduce population below zero: " + String(colony.id || "unknown"));
  if (delta === 0) return { before, after, delta, groupChanges: [] };

  const entries = Object.entries(colony.populationGroups)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const nextGroups = clonePopulationGroups(colony.populationGroups);
  const groupChanges = [];

  if (delta > 0) {
    const groupBefore = nextGroups.unclassified?.population ?? 0;
    if (Object.hasOwn(nextGroups, "unclassified")) {
      nextGroups.unclassified.population += delta;
    } else {
      nextGroups.unclassified = {
        id: "unclassified",
        population: delta,
        dimensions: {}
      };
    }
    groupChanges.push({
      groupId: "unclassified",
      before: groupBefore,
      after: nextGroups.unclassified.population
    });
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
      if (population !== group.population) {
        groupChanges.push({ groupId, before: group.population, after: population });
      }
    }
  }

  const total = writePopulationGroups(colony, nextGroups);
  return { before, after: total, delta, groupChanges };
}

function applyPopulationGroupSplit(colony, {
  sourceGroupId,
  newGroupId,
  population,
  sourceDimensions,
  newDimensions
} = {}) {
  readColonyPopulation(colony);
  if (typeof sourceGroupId !== "string" || !POPULATION_ID_PATTERN.test(sourceGroupId)) {
    throw new TypeError("Population split requires a valid source group ID");
  }
  if (typeof newGroupId !== "string" || !POPULATION_ID_PATTERN.test(newGroupId) || newGroupId === sourceGroupId) {
    throw new TypeError("Population split requires a different valid new group ID");
  }
  if (Object.hasOwn(colony.populationGroups, newGroupId)) {
    throw new Error("Population split target group already exists: " + newGroupId);
  }
  if (!Number.isFinite(population) || population <= 0) {
    throw new RangeError("Population split count must be positive");
  }

  const source = colony.populationGroups[sourceGroupId];
  if (!source) throw new Error("Population split references missing source group: " + sourceGroupId);
  if (population >= source.population) {
    throw new RangeError("Population split must leave people in the source group");
  }

  const hasSourceDimensions = sourceDimensions !== undefined;
  const hasNewDimensions = newDimensions !== undefined;
  if (hasSourceDimensions !== hasNewDimensions) {
    throw new Error("Population split must provide both resulting dimension maps or neither");
  }

  let nextSourceDimensions = cloneDimensions(source.dimensions);
  let nextNewDimensions = cloneDimensions(source.dimensions);
  if (hasSourceDimensions) {
    validateDimensions(sourceDimensions, "population split source " + sourceGroupId);
    validateDimensions(newDimensions, "population split target " + newGroupId);
    if (!sameDimensionSet(source.dimensions, sourceDimensions)
      || !sameDimensionSet(source.dimensions, newDimensions)) {
      throw new Error("Population group split cannot add or remove dimensions: " + sourceGroupId);
    }
    assertDimensionMassConserved(
      source.dimensions,
      sourceDimensions,
      newDimensions,
      source.population,
      source.population - population,
      population,
      sourceGroupId
    );
    nextSourceDimensions = cloneDimensions(sourceDimensions);
    nextNewDimensions = cloneDimensions(newDimensions);
  }

  const nextGroups = clonePopulationGroups(colony.populationGroups);
  const sourcePopulationBefore = source.population;
  nextGroups[sourceGroupId].population -= population;
  nextGroups[sourceGroupId].dimensions = nextSourceDimensions;
  nextGroups[newGroupId] = {
    id: newGroupId,
    population,
    dimensions: nextNewDimensions
  };
  writePopulationGroups(colony, nextGroups);

  return {
    colonyId: colony.id,
    sourceGroupId,
    newGroupId,
    sourcePopulationBefore,
    sourcePopulationAfter: nextGroups[sourceGroupId].population,
    newGroupPopulation: population,
    sourceDimensionsAfter: cloneDimensions(nextSourceDimensions),
    newDimensions: cloneDimensions(nextNewDimensions)
  };
}

function mergeDimensionDistributions(target, source, targetPopulation, sourcePopulation, totalPopulation) {
  const categoryIds = [...new Set([...Object.keys(target), ...Object.keys(source)])].sort();
  const merged = {};
  let proportionTotal = 0;
  for (const categoryId of categoryIds) {
    const proportion = (
      targetPopulation * (target[categoryId] ?? 0)
      + sourcePopulation * (source[categoryId] ?? 0)
    ) / totalPopulation;
    if (proportion > 0) {
      merged[categoryId] = proportion;
      proportionTotal += proportion;
    }
  }
  for (const categoryId of Object.keys(merged)) {
    merged[categoryId] /= proportionTotal;
  }
  return merged;
}

function applyPopulationGroupMerge(colony, { sourceGroupId, targetGroupId } = {}) {
  readColonyPopulation(colony);
  if (typeof sourceGroupId !== "string" || !POPULATION_ID_PATTERN.test(sourceGroupId)
    || typeof targetGroupId !== "string" || !POPULATION_ID_PATTERN.test(targetGroupId)
    || sourceGroupId === targetGroupId) {
    throw new TypeError("Population merge requires two different valid group IDs");
  }
  const source = colony.populationGroups[sourceGroupId];
  const target = colony.populationGroups[targetGroupId];
  if (!source || !target) throw new Error("Population merge references a missing source or target group");
  if (!sameDimensionSet(source.dimensions, target.dimensions)) {
    throw new Error("Population groups can only merge when their dimension sets match");
  }
  const mergedPopulation = target.population + source.population;
  if (!Number.isFinite(mergedPopulation) || mergedPopulation <= 0) {
    throw new RangeError("Cannot merge two empty population groups");
  }

  const mergedDimensions = {};
  for (const dimensionId of Object.keys(target.dimensions)) {
    mergedDimensions[dimensionId] = mergeDimensionDistributions(
      target.dimensions[dimensionId],
      source.dimensions[dimensionId],
      target.population,
      source.population,
      mergedPopulation
    );
  }

  const nextGroups = clonePopulationGroups(colony.populationGroups);
  const targetPopulationBefore = target.population;
  nextGroups[targetGroupId].population = mergedPopulation;
  nextGroups[targetGroupId].dimensions = mergedDimensions;
  delete nextGroups[sourceGroupId];
  writePopulationGroups(colony, nextGroups);

  return {
    colonyId: colony.id,
    sourceGroupId,
    targetGroupId,
    sourcePopulationMerged: source.population,
    targetPopulationBefore,
    targetPopulationAfter: mergedPopulation,
    dimensions: cloneDimensions(mergedDimensions)
  };
}

function applyPopulationGroupDimensionSet(colony, { groupId, dimensionId, distribution } = {}) {
  readColonyPopulation(colony);
  if (typeof groupId !== "string" || !POPULATION_ID_PATTERN.test(groupId)) {
    throw new TypeError("Population dimension update requires a valid group ID");
  }
  if (typeof dimensionId !== "string") throw new TypeError("Population dimension update requires a dimension ID");
  validateDimensionDistribution(dimensionId, distribution, "population group " + groupId);
  const group = colony.populationGroups[groupId];
  if (!group) throw new Error("Population dimension update references a missing group: " + groupId);

  const nextGroups = clonePopulationGroups(colony.populationGroups);
  const before = group.dimensions[dimensionId] ? { ...group.dimensions[dimensionId] } : null;
  nextGroups[groupId].dimensions[dimensionId] = { ...distribution };
  writePopulationGroups(colony, nextGroups);

  return {
    colonyId: colony.id,
    groupId,
    dimensionId,
    before,
    after: { ...distribution },
    population: group.population
  };
}

module.exports = {
  createPopulationGroups,
  getPopulationTotal,
  validatePopulationGroups,
  matchPopulationDimensionCategories,
  applyPopulationDelta,
  applyPopulationGroupSplit,
  applyPopulationGroupMerge,
  applyPopulationGroupDimensionSet
};
