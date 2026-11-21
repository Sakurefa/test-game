"use strict";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function settleSystemEvent(event, {
  world, catalog, day, trigger, resolutions, calculations, randomStreams, applyEffect
} = {}) {
  if (!isRecord(world) || !Number.isInteger(day) || day < 0
    || !resolutions || typeof resolutions.resolve !== "function"
    || typeof applyEffect !== "function") {
    throw new TypeError("System Event settlement requires a world, campaign day, Resolution registry and Effect executor");
  }
  if (!isRecord(event) || typeof event.type !== "string" || !isRecord(event.payload)) {
    throw new TypeError("System Event settlement requires a valid System Event");
  }

  const plan = resolutions.resolve(event, {
    world: structuredClone(world),
    catalog,
    day,
    trigger,
    calculations,
    randomStreams
  });

  const appliedEffects = [];
  for (const [index, effect] of plan.effects.entries()) {
    const result = applyEffect({ event, effect, index, world, catalog, day, trigger });
    if (result && typeof result.then === "function") {
      if (typeof result.catch === "function") result.catch(() => {});
      throw new TypeError("System Event Effect execution must be synchronous");
    }
    appliedEffects.push({ effectType: effect.type, result });
  }

  return {
    result: plan.result,
    effects: appliedEffects,
    domainEvents: plan.domainEvents
  };
}

module.exports = { settleSystemEvent };
