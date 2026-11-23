"use strict";

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function requireNumber(object, key, minimum = -Infinity, maximum = Infinity) {
  const value = object[key];
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError("Invalid Core simulation input: " + key);
  }
  return value;
}

function record(formulaId, version, inputs, result, steps = [], modifiers = [], randomDraws = []) {
  return {
    formulaId, version, inputs, result, steps, modifiers, randomDraws
  };
}

function calculatePopulationNeeds(inputs) {
  const population = requireNumber(inputs, "population", 0);
  if (!Array.isArray(inputs.requirements)) throw new TypeError("Population needs require a requirements array");
  const requirements = new Map();
  for (const item of inputs.requirements) {
    if (!item || typeof item.commodityId !== "string") throw new TypeError("Population needs require commodity IDs");
    const rate = requireNumber(item, "dailyNeedPerThousand", 0);
    const available = requireNumber(item, "available", 0);
    const previous = requirements.get(item.commodityId);
    requirements.set(item.commodityId, {
      dailyNeedPerThousand: (previous?.dailyNeedPerThousand || 0) + rate,
      available
    });
  }
  const requested = {}, consumed = {}, unmet = {}, satisfaction = {};
  for (const [commodityId, requirement] of requirements) {
    const quantity = round(population / 1000 * requirement.dailyNeedPerThousand, 3);
    const actual = Math.min(quantity, requirement.available);
    requested[commodityId] = quantity;
    consumed[commodityId] = actual;
    unmet[commodityId] = Math.max(0, quantity - actual);
    satisfaction[commodityId] = quantity > 0 ? round(actual / quantity, 4) : 1;
  }
  return {
    result: { requested, consumed, unmet, satisfaction },
    steps: [
      { id: "population", value: population, detail: "Colony aggregate population" },
      { id: "requested-needs", value: requested, detail: "Mod-defined daily commodity demand rates" },
      { id: "consumed-needs", value: consumed, detail: "Limited by shared colony inventory" },
      { id: "unmet-needs", value: unmet, detail: "" },
      { id: "needs-satisfaction", value: satisfaction, detail: "" }
    ],
    modifiers: [],
    randomDraws: []
  };
}

function calculateProduction(inputs) {
  const level = requireNumber(inputs, "level", 0.0000001, requireNumber(inputs, "maximumIndustryLevel", 0.0000001));
  const stability = requireNumber(inputs, "stability", 0, 100);
  const minimumEfficiency = requireNumber(inputs, "minimumEfficiency", 0);
  const maximumEfficiency = requireNumber(inputs, "maximumEfficiency", minimumEfficiency);
  const stabilityScale = requireNumber(inputs, "stabilityScale", 0.0000001);
  if (minimumEfficiency > maximumEfficiency) throw new RangeError("Invalid Core production efficiency range");
  if (!Array.isArray(inputs.recipeInputs) || !Array.isArray(inputs.recipeOutputs) || inputs.recipeOutputs.length === 0) {
    throw new TypeError("Production requires recipe inputs and at least one output");
  }
  const efficiency = clamp(stability / stabilityScale, minimumEfficiency, maximumEfficiency);
  const requestedBatches = level * efficiency;
  const requirements = new Map();
  for (const item of inputs.recipeInputs) {
    if (!item || typeof item.commodityId !== "string") throw new TypeError("Production input requires a commodity ID");
    const quantity = requireNumber(item, "quantity", 0.0000001);
    const available = requireNumber(item, "available", 0);
    const previous = requirements.get(item.commodityId);
    requirements.set(item.commodityId, {
      quantity: (previous?.quantity || 0) + quantity,
      available
    });
  }
  let batchScale = requestedBatches;
  let limitingInput = null;
  for (const [commodityId, requirement] of requirements) {
    const possible = requirement.available / requirement.quantity;
    if (possible < batchScale) {
      batchScale = possible;
      limitingInput = commodityId;
    }
  }
  batchScale = Math.max(0, batchScale);
  const consumed = {}, produced = {};
  for (const [commodityId, requirement] of requirements) {
    consumed[commodityId] = requirement.quantity * batchScale;
  }
  for (const item of inputs.recipeOutputs) {
    if (!item || typeof item.commodityId !== "string") throw new TypeError("Production output requires a commodity ID");
    const quantity = requireNumber(item, "quantity", 0.0000001);
    produced[item.commodityId] = (produced[item.commodityId] || 0) + quantity * batchScale;
  }
  return {
    result: { efficiency, requestedBatches, batchScale, limitingInput, consumed, produced },
    steps: [
      { id: "stability-efficiency", value: efficiency, detail: "Colony stability scaled by Mod-defined stabilityScale and efficiency limits" },
      { id: "requested-batches", value: requestedBatches, detail: "Industry level × stability efficiency" },
      { id: "batch-scale", value: batchScale, detail: "" },
      { id: "consumed-inputs", value: consumed, detail: "" },
      { id: "produced-outputs", value: produced, detail: "" }
    ],
    modifiers: limitingInput ? [{
      id: "input-stock-limit",
      value: batchScale - requestedBatches,
      reason: "Limited by available " + limitingInput
    }] : [],
    randomDraws: []
  };
}

function calculateCommodityPrice(inputs, api, streamId) {
  const base = requireNumber(inputs, "basePrice", 0.0000001);
  const targetStock = requireNumber(inputs, "targetStock", 0.0000001);
  const stock = requireNumber(inputs, "stock", 0);
  const elasticity = requireNumber(inputs, "priceElasticity", 0);
  const volatility = requireNumber(inputs, "volatility", 0);
  const previousPrice = requireNumber(inputs, "previousPrice", 0.0000001);
  const minimumMultiplier = requireNumber(inputs, "minimumPriceMultiplier", 0.0000001);
  const maximumMultiplier = requireNumber(inputs, "maximumPriceMultiplier", minimumMultiplier);
  const scarcityMinimum = requireNumber(inputs, "scarcityMinimum");
  const scarcityMaximum = requireNumber(inputs, "scarcityMaximum", scarcityMinimum);
  const fundamentalMinimum = requireNumber(inputs, "fundamentalMinimumMultiplier", 0.0000001);
  const fundamentalMaximum = requireNumber(inputs, "fundamentalMaximumMultiplier", fundamentalMinimum);
  const adjustmentRate = requireNumber(inputs, "priceAdjustmentRate", 0);
  if (minimumMultiplier > maximumMultiplier || scarcityMinimum > scarcityMaximum
    || fundamentalMinimum > fundamentalMaximum || adjustmentRate > 1) {
    throw new RangeError("Invalid Mod-defined commodity pricing policy");
  }
  const floor = base * minimumMultiplier;
  const ceiling = base * maximumMultiplier;
  const previous = clamp(previousPrice, floor, ceiling);
  const scarcity = clamp((targetStock - stock) / targetStock, scarcityMinimum, scarcityMaximum);
  const fundamentals = base * clamp(1 + scarcity * elasticity, fundamentalMinimum, fundamentalMaximum);
  const roll = api.random(streamId);
  const noise = (roll - 0.5) * volatility;
  const rawTarget = fundamentals * (1 + noise);
  const target = clamp(rawTarget, floor, ceiling);
  const price = round(clamp(previous + (target - previous) * adjustmentRate, floor, ceiling), 3);
  return {
    result: { price, change: round((price - previous) / previous * 100, 2) },
    steps: [
      { id: "scarcity", value: scarcity, detail: "" },
      { id: "fundamental-price", value: fundamentals, detail: "" },
      { id: "target-price", value: target, detail: "" },
      { id: "final-price", value: price, detail: "" }
    ],
    modifiers: [{ id: "market-volatility", value: noise, reason: "Deterministic Mod-scoped price variation" }],
    randomDraws: [{ streamId, method: "next", args: [], value: roll }]
  };
}

function calculateSecurityPrice(inputs, api, streamId) {
  const initial = requireNumber(inputs, "initialPrice", 0.0000001);
  const previousPrice = requireNumber(inputs, "previousPrice", 0.0000001);
  const outputValue = requireNumber(inputs, "outputValue", 0);
  const volatility = requireNumber(inputs, "volatility", 0);
  const maximumDailyChange = requireNumber(inputs, "maximumDailyChange", 0.0000001, 1);
  const minimumMultiplier = requireNumber(inputs, "minimumPriceMultiplier", 0.0000001);
  const maximumMultiplier = requireNumber(inputs, "maximumPriceMultiplier", minimumMultiplier);
  const driftPerUnit = requireNumber(inputs, "outputDriftPerUnit", 0);
  const maximumDrift = requireNumber(inputs, "maximumOutputDrift", 0);
  if (minimumMultiplier > maximumMultiplier) throw new RangeError("Invalid Mod-defined security price corridor");
  const floor = initial * minimumMultiplier;
  const ceiling = initial * maximumMultiplier;
  const previous = clamp(previousPrice, floor, ceiling);
  const drift = clamp(outputValue * driftPerUnit, 0, maximumDrift);
  const roll = api.random(streamId);
  const noise = (roll - 0.5) * volatility;
  const rawMove = noise + drift;
  const move = clamp(rawMove, -maximumDailyChange, maximumDailyChange);
  const price = round(clamp(previous * (1 + move), floor, ceiling), 3);
  return {
    result: { price, change: round((price - previous) / previous * 100, 2) },
    steps: [
      { id: "operational-drift", value: drift, detail: "Issuer output signal using Mod-defined parameters" },
      { id: "daily-change", value: move, detail: "" },
      { id: "final-price", value: price, detail: "" }
    ],
    modifiers: [{ id: "market-volatility", value: noise, reason: "Deterministic Mod-scoped price variation" }],
    randomDraws: [{ streamId, method: "next", args: [], value: roll }]
  };
}

function formulaPopulationNeeds(input, api) {
  const calculation = calculatePopulationNeeds(input.inputs);
  for (const step of calculation.steps) api.recordStep(step.id, step.value, step.detail);
  return calculation.result;
}

function formulaColonyProduction(input, api) {
  const calculation = calculateProduction(input.inputs);
  for (const step of calculation.steps) api.recordStep(step.id, step.value, step.detail);
  for (const modifier of calculation.modifiers) api.recordModifier(modifier.id, modifier.value, modifier.reason);
  return calculation.result;
}

function formulaCommodityPrice(input, api) {
  const calculation = calculateCommodityPrice(input.inputs, api, "formula:" + input.randomScope);
  for (const step of calculation.steps) api.recordStep(step.id, step.value, step.detail);
  for (const modifier of calculation.modifiers) api.recordModifier(modifier.id, modifier.value, modifier.reason);
  return calculation.result;
}

function formulaSecurityPrice(input, api) {
  const calculation = calculateSecurityPrice(input.inputs, api, "formula:" + input.randomScope);
  for (const step of calculation.steps) api.recordStep(step.id, step.value, step.detail);
  for (const modifier of calculation.modifiers) api.recordModifier(modifier.id, modifier.value, modifier.reason);
  return calculation.result;
}

function onWeeklyProduction(input, api) {
  const effects = [], events = [], calculations = [];
  const recipes = new Map((input.catalog.recipes || []).map((item) => [item.id, item]));
  const commodities = new Map((input.catalog.commodities || []).map((item) => [item.id, item]));
  for (const colony of Object.values(input.world.colonies || {}).sort((a, b) => a.id.localeCompare(b.id))) {
    const workingStock = { ...colony.stockpiles };
    const output = {};
    const industryReports = [];
    let activeIndustryCount = 0;
    for (let industryIndex = 0; industryIndex < colony.industries.length; industryIndex += 1) {
      const industry = colony.industries[industryIndex];
      const recipe = recipes.get(industry.recipeId);
      if (!recipe) throw new Error("Core production cannot find recipe " + industry.recipeId);
      const recipeInputs = (recipe.inputs || []).map((item) => ({
        commodityId: item.commodityId,
        quantity: item.quantity,
        available: workingStock[item.commodityId] || 0
      }));
      const formulaInputs = {
        level: industry.level,
        stability: colony.stability,
        maximumIndustryLevel: recipe.maximumIndustryLevel,
        minimumEfficiency: recipe.minimumEfficiency,
        maximumEfficiency: recipe.maximumEfficiency,
        stabilityScale: recipe.stabilityScale,
        recipeInputs,
        recipeOutputs: recipe.outputs || []
      };
      const calculation = calculateProduction(formulaInputs);
      const result = calculation.result;
      const requestedOutput = {};
      for (const item of recipe.outputs || []) {
        requestedOutput[item.commodityId] = round((requestedOutput[item.commodityId] || 0)
          + item.quantity * result.requestedBatches, 3);
      }
      const limitingInput = result.limitingInput;
      const limitingStock = limitingInput
        ? recipeInputs.find((item) => item.commodityId === limitingInput) : null;
      const status = result.batchScale <= 0 ? "no-output"
        : result.batchScale + 1e-9 < result.requestedBatches ? "limited" : "normal";
      industryReports.push({
        industryIndex,
        recipeId: industry.recipeId,
        level: industry.level,
        requestedBatches: result.requestedBatches,
        actualBatches: result.batchScale,
        efficiency: result.efficiency,
        status,
        limitingInput,
        limitingAvailable: limitingStock?.available ?? null,
        limitingRequired: limitingStock ? round(limitingStock.quantity * result.requestedBatches, 3) : null,
        requestedOutput,
        consumed: result.consumed,
        produced: result.produced
      });
      calculations.push(record("economy.colony-production", 1, formulaInputs, result,
        calculation.steps, calculation.modifiers, []));
      if (result.batchScale <= 0) continue;
      activeIndustryCount += 1;
      for (const [commodityId, quantity] of Object.entries(result.consumed)) {
        const actual = round(quantity, 3);
        if (actual > 0) {
          effects.push({ type: "colony.stockpile.delta", payload: { colonyId: colony.id, commodityId, delta: -actual } });
          workingStock[commodityId] = round((workingStock[commodityId] || 0) - actual, 3);
        }
      }
      for (const [commodityId, quantity] of Object.entries(result.produced)) {
        const actual = round(quantity, 3);
        if (actual > 0) {
          effects.push({ type: "colony.stockpile.delta", payload: { colonyId: colony.id, commodityId, delta: actual } });
          workingStock[commodityId] = round((workingStock[commodityId] || 0) + actual, 3);
          output[commodityId] = round((output[commodityId] || 0) + actual, 3);
        }
      }
    }
    effects.push({
      type: "colony.production.report.set",
      payload: { colonyId: colony.id, day: input.day, production: output, industries: industryReports }
    });
    events.push({
      type: "colony.production-settled",
      scope: "colony",
      subjectId: colony.id,
      payload: { industryCount: colony.industries.length, activeIndustryCount, production: output }
    });
  }
  return { effects, events, calculations };
}

function onDailyNeeds(input) {
  const effects = [], events = [], calculations = [];
  const commodities = input.catalog.commodities || [];
  for (const commodity of commodities) {
    if (commodity.dailyNeedPerThousand !== undefined) {
      requireNumber(commodity, "dailyNeedPerThousand", 0);
    }
  }
  for (const colony of Object.values(input.world.colonies || {}).sort((a, b) => a.id.localeCompare(b.id))) {
    const requirements = commodities
      .filter((commodity) => Number.isFinite(commodity.dailyNeedPerThousand) && commodity.dailyNeedPerThousand > 0)
      .map((commodity) => ({
        commodityId: commodity.id,
        dailyNeedPerThousand: commodity.dailyNeedPerThousand,
        available: Math.max(0, colony.stockpiles[commodity.id] || 0)
      }));
    const population = colony.population;
    const calculation = calculatePopulationNeeds({ population, requirements });
    const result = calculation.result;
    const needs = requirements.map((requirement) => {
      const commodityId = requirement.commodityId;
      const requested = result.requested[commodityId] || 0;
      const consumed = result.consumed[commodityId] || 0;
      const unmet = result.unmet[commodityId] || 0;
      if (consumed > 0) {
        effects.push({ type: "colony.stockpile.delta", payload: { colonyId: colony.id, commodityId, delta: -consumed } });
      }
      return {
        commodityId,
        available: requirement.available,
        requested,
        consumed,
        unmet,
        satisfaction: result.satisfaction[commodityId] ?? 1,
        status: unmet > 0 ? "shortage" : "met"
      };
    });
    const shortageCount = needs.filter((item) => item.unmet > 0).length;
    effects.push({
      type: "colony.needs.report.set",
      payload: { colonyId: colony.id, day: input.day, population, needs, shortageCount }
    });
    calculations.push(record("economy.population-needs", 2, { population, requirements }, result,
      calculation.steps, calculation.modifiers, []));
    events.push({
      type: "colony.needs-settled",
      scope: "colony",
      subjectId: colony.id,
      payload: { needCount: needs.length, shortageCount, needs }
    });
  }
  return { effects, events, calculations };
}

function onDailyMarketPricing(input, api) {
  const effects = [], events = [], calculations = [];
  const commodityDefinitions = new Map((input.catalog.commodities || []).map((item) => [item.id, item]));
  const securities = new Map((input.catalog.securities || []).map((item) => [item.id, item]));
  const companies = new Map((input.catalog.companies || []).map((item) => [item.id, item]));
  const markets = Object.values(input.world.markets || {}).sort((a, b) => a.id.localeCompare(b.id));
  for (const marketState of markets) {
    const definition = (input.catalog.markets || []).find((item) => item.id === marketState.id);
    if (!definition) throw new Error("Core market pricing cannot find market " + marketState.id);
    const colony = input.world.colonies[definition.colonyId];
    const changes = {};
    for (const commodityId of definition.commodityIds || []) {
      const commodity = commodityDefinitions.get(commodityId);
      const stock = colony.stockpiles[commodityId] || 0;
      const previous = marketState.prices[commodityId] ?? commodity.basePrice;
      const formulaInputs = {
        basePrice: commodity.basePrice,
        targetStock: commodity.targetStock,
        stock,
        priceElasticity: commodity.priceElasticity,
        volatility: commodity.volatility,
        previousPrice: previous,
        minimumPriceMultiplier: commodity.minimumPriceMultiplier,
        maximumPriceMultiplier: commodity.maximumPriceMultiplier,
        scarcityMinimum: commodity.scarcityMinimum,
        scarcityMaximum: commodity.scarcityMaximum,
        fundamentalMinimumMultiplier: commodity.fundamentalMinimumMultiplier,
        fundamentalMaximumMultiplier: commodity.fundamentalMaximumMultiplier,
        priceAdjustmentRate: commodity.priceAdjustmentRate
      };
      const streamId = "commodity:" + marketState.id + ":" + commodityId;
      const calculation = calculateCommodityPrice(formulaInputs, api, streamId);
      effects.push({ type: "market.price.set", payload: { marketId: marketState.id, instrumentId: commodityId, price: calculation.result.price } });
      changes[commodityId] = calculation.result.change;
      calculations.push(record("economy.commodity-price", 3, formulaInputs, calculation.result,
        calculation.steps, calculation.modifiers, calculation.randomDraws));
    }
    for (const securityId of definition.securityIds || []) {
      const security = securities.get(securityId);
      const company = companies.get(security.issuerId);
      const outputValue = (company.colonyIds || []).reduce((sum, colonyId) => {
        const production = input.world.colonies[colonyId]?.lastProduction || {};
        return sum + Object.values(production).reduce((total, quantity) => total + quantity, 0);
      }, 0);
      const previous = marketState.prices[securityId] ?? security.initialPrice;
      const formulaInputs = {
        outputValue,
        volatility: security.volatility,
        previousPrice: previous,
        initialPrice: security.initialPrice,
        maximumDailyChange: security.maximumDailyChange,
        minimumPriceMultiplier: security.minimumPriceMultiplier,
        maximumPriceMultiplier: security.maximumPriceMultiplier,
        outputDriftPerUnit: security.outputDriftPerUnit,
        maximumOutputDrift: security.maximumOutputDrift
      };
      const streamId = "security:" + marketState.id + ":" + securityId;
      const calculation = calculateSecurityPrice(formulaInputs, api, streamId);
      effects.push({ type: "market.price.set", payload: { marketId: marketState.id, instrumentId: securityId, price: calculation.result.price } });
      changes[securityId] = calculation.result.change;
      calculations.push(record("economy.security-price", 3, formulaInputs, calculation.result,
        calculation.steps, calculation.modifiers, calculation.randomDraws));
    }
    events.push({
      type: "market.prices-settled",
      scope: "market",
      subjectId: marketState.id,
      payload: { instrumentCount: Object.keys(changes).length, changes }
    });
  }
  return { effects, events, calculations };
}

function onDailyWarChronology(input) {
  const effects = [], events = [];
  const wars = Object.values(input.world.wars || {}).sort((a, b) => a.id.localeCompare(b.id));
  for (const war of wars) {
    if (war.status !== "active") continue;
    effects.push({ type: "war.days-active.delta", payload: { warId: war.id, delta: 1 } });
    events.push({
      type: "war.chronology-advanced",
      scope: "war",
      subjectId: war.id,
      payload: { daysActive: war.daysActive + 1 }
    });
  }
  return { effects, events };
}

