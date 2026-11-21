const { NamedRandomStreams, hashSeed } = require("./random.cjs");
const { createCalculationService, CALCULATION_AUDIT_LIMIT } = require("./formulas.cjs");
const { createClock, advanceClock, advanceClockTime } = require("./clock.cjs");
const { createSystemRegistry } = require("./system-registry.cjs");
const { createDomainEventEmitter, validateDomainEventState } = require("./domain-events.cjs");
const { validateCommandReceiptState } = require("./commands.cjs");
const { createFinancialLedger, validateWorldFinancialState } = require("./ledger.cjs");
const { createModExtensionRuntime, applyModHookResults, validateModState } = require("./mod-runtime.cjs");

const modRuntimeCache = new WeakMap();

function getModRuntime(catalog) {
  if (!modRuntimeCache.has(catalog)) {
    modRuntimeCache.set(catalog, createModExtensionRuntime(catalog.extensions || []));
  }
  return modRuntimeCache.get(catalog);
}

function runModHook(modRuntime, hookId, input, { world, catalog, day, subjectKey = "world", emitDomainEvent }) {
  const outcomes = modRuntime.run(hookId, input, {
    randomScope: subjectKey,
    modStateById: world.modState || {}
  });
  return applyModHookResults(outcomes, { world, catalog, day, hookId, subjectKey, emitDomainEvent });
}

const GAME_STATE_SCHEMA_VERSION = 7;
const MAX_ADVANCE_DAYS = 30;
const MAX_CAMPAIGN_CATCH_UP_DAYS = 3650;
const LOG_LIMIT = 100;

function localized(catalog, key) {
  return catalog.localizations?.[catalog.defaultLocale]?.[key] || `[${key || "missing-localization-key"}]`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function createWorld(catalog, options = {}) {
  if (!catalog?.universe || !catalog?.contentHash) throw new TypeError("A validated content catalog is required");
  const seed = hashSeed(options.seed ?? Date.now());
  const randomStreams = new NamedRandomStreams(seed);
  const colonies = {};
  for (const definition of catalog.colonies.values()) {
    colonies[definition.id] = {
      id: definition.id,
      population: definition.population,
      stability: definition.stability,
      stockpiles: { ...definition.stockpiles },
      industries: definition.industries.map((industry) => ({ ...industry })),
      lastProduction: {},
      lastProductionReport: null,
      lastNeedsReport: null
    };
  }

  const markets = {};
  for (const definition of catalog.markets.values()) {
    const prices = {};
    for (const commodityId of definition.commodityIds || []) {
      prices[commodityId] = catalog.commodities.get(commodityId).basePrice;
    }
    for (const securityId of definition.securityIds || []) {
      prices[securityId] = catalog.securities.get(securityId).initialPrice;
    }
    markets[definition.id] = { id: definition.id, prices, lastChanges: {} };
  }

  const fleets = {};
  for (const definition of catalog.fleets.values()) {
    fleets[definition.id] = {
      id: definition.id,
      locationId: definition.locationId,
      factionId: definition.factionId,
      ships: definition.ships.map((ship) => ({ ...ship })),
      readiness: definition.readiness ?? 100,
      morale: definition.morale ?? 70,
      stance: definition.stance || "patrol",
      orders: []
    };
  }

  const wars = {};
  for (const definition of catalog.wars.values()) {
    wars[definition.id] = {
      id: definition.id,
      status: definition.status || "cold",
      participants: [...definition.participants],
      startedOn: definition.startedOn || catalog.universe.startDate,
      daysActive: Math.max(0, Math.floor((Date.parse(catalog.universe.startDate + "T00:00:00Z") - Date.parse((definition.startedOn || catalog.universe.startDate) + "T00:00:00Z")) / 86400000)),
      warWeariness: Object.fromEntries(definition.participants.map((id) => [id, 0]))
    };
  }

  const playerFactionId = options.playerFactionId || catalog.universe.defaultPlayerFactionId;
  const finance = createFinancialLedger({ playerFactionId, startDate: catalog.universe.startDate });

  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    contentHash: catalog.contentHash,
    metadata: {
      name: options.name || `${catalog.localizations?.[catalog.defaultLocale]?.[catalog.universe.nameKey] || catalog.universe.id} — 新航程`,
      seed,
      createdAt: options.createdAt || new Date().toISOString()
    },
    universeId: catalog.universe.id,
    clock: createClock(catalog.universe.startDate),
    scheduler: { lastRunDayBySystem: {} },
    rng: randomStreams.snapshot(),
    audit: { calculations: [] },
    domainEventSequence: 0,
    domainEvents: [],
    commandReceipts: [],
    modState: {},
    player: { factionId: playerFactionId, accountId: "player-main" },
    finance,
    colonies,
    markets,
    fleets,
    wars,
    events: [{
      id: "world-founded",
      day: 0,
      date: catalog.universe.startDate,
      type: "system",
      text: `新航程在${localized(catalog, catalog.universe.nameKey)}展开。`
    }]
  };
}

function produceForColony(catalog, colonyState, calculations, day, emitDomainEvent, world, modRuntime) {
  runModHook(modRuntime, "colony.before-production", {
    day, colonyId: colonyState.id, colony: colonyState
  }, { world, catalog, day, subjectKey: colonyState.id, emitDomainEvent });
  const output = {};
  const industryReports = [];
  let activeIndustryCount = 0;
  for (let industryIndex = 0; industryIndex < colonyState.industries.length; industryIndex += 1) {
    const industry = colonyState.industries[industryIndex];
    const recipe = catalog.recipes.get(industry.recipeId);
    const recipeInputs = (recipe.inputs || []).map((input) => ({
      commodityId: input.commodityId,
      quantity: input.quantity,
      available: colonyState.stockpiles[input.commodityId] || 0
    }));
    const { result } = calculations.evaluate("economy.colony-production", {
      level: industry.level, stability: colonyState.stability,
      recipeInputs, recipeOutputs: recipe.outputs || []
    }, { day });

    const inputTotals = new Map();
    for (const input of recipeInputs) {
      const prior = inputTotals.get(input.commodityId);
      inputTotals.set(input.commodityId, {
        quantity: (prior?.quantity || 0) + input.quantity,
        available: input.available
      });
    }
    const requestedOutput = {};
    for (const item of recipe.outputs || []) {
      requestedOutput[item.commodityId] = round(
        (requestedOutput[item.commodityId] || 0) + item.quantity * result.requestedBatches, 3
      );
    }
    const consumed = { ...result.consumed };
    const produced = Object.fromEntries(Object.entries(result.produced)
      .map(([commodityId, quantity]) => [commodityId, round(quantity, 3)]));
    const limitingStock = result.limitingInput ? inputTotals.get(result.limitingInput) : null;
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
      limitingInput: result.limitingInput,
      limitingAvailable: limitingStock?.available ?? null,
      limitingRequired: limitingStock ? round(limitingStock.quantity * result.requestedBatches, 3) : null,
      requestedOutput,
      consumed,
      produced
    });

    if (result.batchScale <= 0) continue;
    activeIndustryCount += 1;
    for (const [commodityId, quantity] of Object.entries(result.consumed)) {
      colonyState.stockpiles[commodityId] = round(Math.max(0, (colonyState.stockpiles[commodityId] || 0) - quantity), 3);
    }
    for (const [commodityId, quantity] of Object.entries(result.produced)) {
      const actualQuantity = round(quantity, 3);
      colonyState.stockpiles[commodityId] = round((colonyState.stockpiles[commodityId] || 0) + actualQuantity, 3);
      output[commodityId] = round((output[commodityId] || 0) + actualQuantity, 3);
    }
  }
  colonyState.lastProduction = output;
  colonyState.lastProductionReport = { day, industries: industryReports };
  runModHook(modRuntime, "colony.after-production", {
    day, colonyId: colonyState.id, colony: colonyState, production: output
  }, { world, catalog, day, subjectKey: colonyState.id, emitDomainEvent });
  emitDomainEvent({ type: "colony.production-settled", scope: "colony", subjectId: colonyState.id,
    idempotencyKey: `campaign-day:${day}:colony.production-settled:${colonyState.id}`,
    payload: { industryCount: colonyState.industries.length, activeIndustryCount, production: output } });
  return output;
}

function settlePopulationNeeds(catalog, colonyState, calculations, day, emitDomainEvent) {
  const requirements = [...catalog.commodities.values()]
    .filter((commodity) => Number.isFinite(commodity.dailyNeedPerThousand) && commodity.dailyNeedPerThousand > 0)
    .map((commodity) => ({
      commodityId: commodity.id,
      dailyNeedPerThousand: commodity.dailyNeedPerThousand,
      available: Math.max(0, colonyState.stockpiles[commodity.id] || 0)
    }));

  if (requirements.length === 0) {
    colonyState.lastNeedsReport = { day, population: colonyState.population, needs: [] };
    return colonyState.lastNeedsReport;
  }

  const { result } = calculations.evaluate("economy.population-needs", {
    population: colonyState.population,
    requirements
  }, { day });

  const needs = requirements.map((requirement) => {
    const commodityId = requirement.commodityId;
    const requested = result.requested[commodityId] || 0;
    const consumed = round(result.consumed[commodityId] || 0, 3);
    const unmet = round(result.unmet[commodityId] || 0, 3);
    if (consumed > 0) {
      colonyState.stockpiles[commodityId] = round(
        Math.max(0, requirement.available - consumed), 3
      );
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
  colonyState.lastNeedsReport = {
    day,
    population: colonyState.population,
    needs,
    shortageCount
  };
  emitDomainEvent({
    type: "colony.needs-settled",
    scope: "colony",
    subjectId: colonyState.id,
    idempotencyKey: `campaign-day:${day}:colony.needs-settled:${colonyState.id}`,
    payload: {
      needCount: needs.length,
      shortageCount,
      needs
    }
  });
  return colonyState.lastNeedsReport;
}

function updateMarket(catalog, marketState, colonyState, allColonyStates, randomStreams, calculations, day, emitDomainEvent, world, modRuntime) {
  const market = catalog.markets.get(marketState.id);
  runModHook(modRuntime, "market.before-pricing", {
    day, marketId: marketState.id, market: marketState, colony: colonyState
  }, { world, catalog, day, subjectKey: marketState.id, emitDomainEvent });
  const changes = {};
  for (const commodityId of market.commodityIds || []) {
    const commodity = catalog.commodities.get(commodityId);
    const stock = colonyState.stockpiles[commodityId] || 0;
    const previous = marketState.prices[commodityId] ?? commodity.basePrice;
    const streamId = "economy.market." + marketState.id + "." + commodityId;
    const { result } = calculations.evaluate("economy.commodity-price", {
      basePrice: commodity.basePrice,
      targetStock: commodity.targetStock,
      stock,
      priceElasticity: commodity.priceElasticity,
      volatility: commodity.volatility,
      previousPrice: previous
    }, { random: randomStreams.get(streamId), randomStreamId: streamId, day });
    marketState.prices[commodityId] = result.price;
    changes[commodityId] = result.change;
  }

  for (const securityId of market.securityIds || []) {
    const security = catalog.securities.get(securityId);
    const issuer = catalog.companies.get(security.issuerId);
    const outputValue = issuer.colonyIds.reduce((sum, colonyId) => {
      const production = allColonyStates[colonyId]?.lastProduction || {};
      return sum + Object.values(production).reduce((total, quantity) => total + quantity, 0);
    }, 0);
    const previous = marketState.prices[securityId] ?? security.initialPrice;
    const streamId = "economy.market." + marketState.id + "." + securityId;
    const { result } = calculations.evaluate("economy.security-price", {
      outputValue,
      volatility: security.volatility,
      previousPrice: previous,
      initialPrice: security.initialPrice,
      maxDailyChange: 0.12
    }, { random: randomStreams.get(streamId), randomStreamId: streamId, day });
    marketState.prices[securityId] = result.price;
    changes[securityId] = result.change;
  }
  marketState.lastChanges = changes;
  runModHook(modRuntime, "market.after-pricing", {
    day, marketId: marketState.id, market: marketState, colony: colonyState, changes
  }, { world, catalog, day, subjectKey: marketState.id, emitDomainEvent });
  emitDomainEvent({ type: "market.prices-settled", scope: "market", subjectId: marketState.id,
    idempotencyKey: `campaign-day:${day}:market.prices-settled:${marketState.id}`,
    payload: { instrumentCount: Object.keys(changes).length, changes } });
  return changes;
}


const simulationSystems = createSystemRegistry([
  {
    id: "colonies.production",
    cadence: "weekly",
    order: 10,
    update: ({ world, catalog, summary, calculations, day, emitDomainEvent, modRuntime }) => {
      for (const [colonyId, colonyState] of Object.entries(world.colonies)) {
        summary.production[colonyId] = produceForColony(catalog, colonyState, calculations, day, emitDomainEvent, world, modRuntime);
      }
    }
  },
  {
    id: "population.needs-consumption",
    cadence: "daily",
    order: 15,
    dependsOn: ["colonies.production"],
    update: ({ world, catalog, calculations, summary, day, emitDomainEvent }) => {
      for (const colonyState of Object.values(world.colonies)) {
        summary.needs[colonyState.id] = settlePopulationNeeds(
          catalog, colonyState, calculations, day, emitDomainEvent
        );
      }
    }
  },
  {
    id: "economy.market-pricing",
    cadence: "daily",
    order: 20,
    dependsOn: ["population.needs-consumption"],
    update: ({ world, catalog, randomStreams, calculations, summary, day, emitDomainEvent, modRuntime }) => {
      for (const marketState of Object.values(world.markets)) {
        const definition = catalog.markets.get(marketState.id);
        summary.market[marketState.id] = updateMarket(
          catalog, marketState, world.colonies[definition.colonyId], world.colonies, randomStreams, calculations, day, emitDomainEvent, world, modRuntime
        );
      }
    }
  },
  {
    id: "military.war-chronology",
    cadence: "daily",
    order: 30,
    update: ({ world, emitDomainEvent, modRuntime, catalog, day }) => {
      for (const war of Object.values(world.wars)) {
        if (war.status !== "active") continue;
        war.daysActive += 1;
        emitDomainEvent({ type: "war.chronology-advanced", scope: "war", subjectId: war.id,
          idempotencyKey: `campaign-day:${world.clock.day}:war.chronology-advanced:${war.id}`,
          payload: { daysActive: war.daysActive } });
        runModHook(modRuntime, "war.after-chronology", {
          day, war
        }, { world, catalog, day, subjectKey: war.id, emitDomainEvent });
      }
    }
  }
]);

function appendEvent(world, event) {
  world.events.push(event);
  if (world.events.length > LOG_LIMIT) world.events.splice(0, world.events.length - LOG_LIMIT);
}

function validateWorldState(world, catalog) {
  if (!world || typeof world !== "object" || world.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    throw new Error("Unsupported or invalid game-state schema");
  }
  if (world.contentHash !== catalog.contentHash) {
    const canUpgradeLegacyFingerprint = world.contentHashUpgradePending === true
      && typeof catalog.legacyContentHash === "string"
      && world.contentHash === catalog.legacyContentHash;
    const canUpgradeKnownPopulationClassification = Array.isArray(catalog.compatibleContentHashes)
      && catalog.compatibleContentHashes.includes(world.contentHash);
    if (!canUpgradeLegacyFingerprint && !canUpgradeKnownPopulationClassification) {
      throw new Error("This save was created with different Mod content. Restore the matching Mods before loading.");
    }
    world.contentHash = catalog.contentHash;
  }
  if (world.contentHashUpgradePending !== undefined) delete world.contentHashUpgradePending;
  if (world.universeId !== catalog.universe.id) throw new Error("Save universe does not match the loaded content");
  if (!Number.isInteger(world.rng?.seed) || !world.rng?.streams || typeof world.rng.streams !== "object" || Array.isArray(world.rng.streams)) {
    throw new Error("Save has an invalid named random state");
  }
  new NamedRandomStreams(world.rng.seed, world.rng.streams);
  if (!world.audit || !Array.isArray(world.audit.calculations)) throw new Error("Save has an invalid calculation audit");
  validateDomainEventState(world);
  validateCommandReceiptState(world);
  if (!world.clock || typeof world.clock.date !== "string" || !Number.isInteger(world.clock.day)
    || !Number.isFinite(world.clock.dayFraction) || world.clock.dayFraction < 0 || world.clock.dayFraction >= 1) {
    throw new Error("Save has an invalid game clock");
  }
  if (!world.scheduler || typeof world.scheduler !== "object" || !world.scheduler.lastRunDayBySystem
    || typeof world.scheduler.lastRunDayBySystem !== "object") throw new Error("Save has an invalid simulation scheduler state");
  for (const id of catalog.colonies.keys()) {
    const colony = world.colonies?.[id];
    if (!colony || !colony.stockpiles || !Array.isArray(colony.industries)) throw new Error(`Save is missing or has invalid colony state: ${id}`);
    if (!Number.isFinite(colony.population) || colony.population < 0 || !Number.isFinite(colony.stability) || colony.stability < 0 || colony.stability > 100) {
      throw new Error(`Save has invalid colony population or stability: ${id}`);
    }
    for (const [commodityId, quantity] of Object.entries(colony.stockpiles)) {
      if (!catalog.commodities.has(commodityId) || !Number.isFinite(quantity) || quantity < 0) throw new Error(`Save has invalid stockpile quantity: ${id}.${commodityId}`);
    }
  }
  for (const [id, definition] of catalog.markets) {
    const market = world.markets?.[id];
    if (!market || !market.prices || !market.lastChanges) throw new Error(`Save is missing or has invalid market state: ${id}`);
    for (const instrumentId of [...(definition.commodityIds || []), ...(definition.securityIds || [])]) {
      const price = market.prices[instrumentId];
      if (!Number.isFinite(price) || price <= 0) throw new Error(`Save has invalid market price: ${id}.${instrumentId}`);
      if (!Number.isFinite(market.lastChanges[instrumentId] ?? 0)) throw new Error(`Save has invalid market change: ${id}.${instrumentId}`);
    }
  }
  for (const id of catalog.fleets.keys()) if (!world.fleets?.[id]) throw new Error(`Save is missing fleet state: ${id}`);
  for (const [id, definition] of catalog.wars) {
    const war = world.wars?.[id];
    if (!war || !Number.isInteger(war.daysActive) || war.daysActive < 0 || !war.warWeariness) throw new Error(`Save has invalid war state: ${id}`);
    for (const factionId of definition.participants) if (!Number.isFinite(war.warWeariness[factionId]) || war.warWeariness[factionId] < 0) throw new Error(`Save has invalid war weariness: ${id}.${factionId}`);
  }
  validateWorldFinancialState(world);
  validateModState(world.modState);
  return true;
}

function settleDay(world, catalog) {
  const randomStreams = new NamedRandomStreams(world.rng.seed, world.rng.streams);
  const calculations = createCalculationService();
  const modRuntime = getModRuntime(catalog);
  world.clock = advanceClock(world.clock, 1);
  const summary = { production: {}, needs: {}, market: {} };
  const emitDomainEvent = createDomainEventEmitter(world, world.clock);
  runModHook(modRuntime, "campaign.before-day", {
    day: world.clock.day, date: world.clock.date, world
  }, { world, catalog, day: world.clock.day, emitDomainEvent });
  const systemsRun = simulationSystems.runDue({
    world, day: world.clock.day,
    context: { catalog, randomStreams, calculations, summary, emitDomainEvent, modRuntime }
  });

  runModHook(modRuntime, "campaign.after-day", {
    day: world.clock.day, date: world.clock.date, world, summary, systemsRun
  }, { world, catalog, day: world.clock.day, emitDomainEvent });

  world.rng = randomStreams.snapshot();
  if (!world.audit || typeof world.audit !== "object") world.audit = { calculations: [] };
  if (!Array.isArray(world.audit.calculations)) world.audit.calculations = [];
  const calculationRecords = calculations.getRecords();
  world.audit.calculations.push(...calculationRecords);
  if (world.audit.calculations.length > CALCULATION_AUDIT_LIMIT) {
    world.audit.calculations.splice(0, world.audit.calculations.length - CALCULATION_AUDIT_LIMIT);
  }

  const productionCount = Object.keys(summary.production).length;
  const needsCount = Object.keys(summary.needs).length;
  const marketCount = Object.keys(summary.market).length;
  const report = productionCount > 0
    ? `第 ${world.clock.day} 天结束：${productionCount} 个殖民地完成每周生产，${needsCount} 个殖民地结算日常需求，${marketCount} 个市场更新报价。`
    : `第 ${world.clock.day} 天结束：${needsCount} 个殖民地结算日常需求，${marketCount} 个市场更新报价。`;
  appendEvent(world, {
    id: `day-${world.clock.day}`, day: world.clock.day, date: world.clock.date,
    type: "daily-report", text: report, production: summary.production,
    marketChanges: summary.market, systemsRun
  });
  return { day: world.clock.day, date: world.clock.date, summary, systemsRun, calculations: calculationRecords };
}

function validateDayInputs(world, catalog) {
  if (!world || world.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    throw new Error("DAY_INPUT unsupported or invalid game-state schema");
  }
  if (world.contentHash !== catalog.contentHash) {
    throw new Error("This save was created with different Mod content. Restore the matching Mods before loading.");
  }
  if (world.universeId !== catalog.universe.id) throw new Error("Save universe does not match the loaded content");
  if (!world?.clock || !Number.isInteger(world.clock.day) || typeof world.clock.date !== "string") {
    throw new Error("DAY_INPUT world.clock.day/date is missing or invalid");
  }
  if (!world.rng || !Number.isInteger(world.rng.seed) || !world.rng.streams || typeof world.rng.streams !== "object") {
    throw new Error("DAY_INPUT world.rng seed/streams is missing or invalid");
  }
  if (!world.modState || typeof world.modState !== "object" || Array.isArray(world.modState)) {
    throw new Error("DAY_INPUT world.modState is missing or invalid");
  }
  if (!world.scheduler?.lastRunDayBySystem || typeof world.scheduler.lastRunDayBySystem !== "object") {
    throw new Error("DAY_INPUT world.scheduler.lastRunDayBySystem is missing");
  }
  if (!Array.isArray(world.events) || !Array.isArray(world.domainEvents) || !Number.isInteger(world.domainEventSequence)) {
    throw new Error("DAY_INPUT world event history state is missing or invalid");
  }
  for (const id of catalog.colonies.keys()) {
    const colony = world.colonies?.[id];
    if (!colony || !colony.stockpiles || !Array.isArray(colony.industries)) {
      throw new Error("DAY_INPUT required colony data is missing: " + id);
    }
    if (!Number.isFinite(colony.population) || colony.population <= 0) {
      throw new Error("DAY_INPUT colony population must be greater than zero: " + id);
    }
    if (!Number.isFinite(colony.stability) || colony.stability < 0 || colony.stability > 100) {
      throw new Error("DAY_INPUT colony stability is invalid: " + id);
    }
    for (const industry of colony.industries) {
      if (!catalog.recipes.has(industry.recipeId) || !Number.isFinite(industry.level) || industry.level <= 0) {
        throw new Error("DAY_INPUT industry recipe/level is missing or invalid: " + id + "." + industry.recipeId);
      }
    }
  }
  for (const [id, definition] of catalog.markets) {
    const market = world.markets?.[id];
    if (!market?.prices || !market.lastChanges) throw new Error("DAY_INPUT market state is missing: " + id);
    if (!world.colonies?.[definition.colonyId]) throw new Error("DAY_INPUT market references a missing colony: " + id + "." + definition.colonyId);
    for (const instrumentId of [...(definition.commodityIds || []), ...(definition.securityIds || [])]) {
      const price = market.prices[instrumentId];
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("DAY_INPUT required market price must be greater than zero: " + id + "." + instrumentId);
      }
    }
  }
  for (const id of catalog.fleets.keys()) {
    if (!world.fleets?.[id]) throw new Error("DAY_INPUT fleet state is missing: " + id);
  }
  for (const [id, definition] of catalog.wars) {
    const war = world.wars?.[id];
    if (!war || !Number.isInteger(war.daysActive) || war.daysActive < 0 || !war.warWeariness) {
      throw new Error("DAY_INPUT war state is missing or invalid: " + id);
    }
    for (const factionId of definition.participants) {
      if (!Number.isFinite(war.warWeariness[factionId]) || war.warWeariness[factionId] < 0) {
        throw new Error("DAY_INPUT war weariness is missing or invalid: " + id + "." + factionId);
      }
    }
  }
  validateWorldFinancialState(world);
}

function advanceDay(world, catalog, { eventBus = null, onDaySettled = null } = {}) {
  if (eventBus !== null && (!eventBus || typeof eventBus.publish !== "function")) {
    throw new TypeError("A domain event bus must provide publish(event)");
  }
  validateDayInputs(world, catalog);
  const previousEventSequence = world.domainEventSequence;
  const candidate = structuredClone(world);
  const detail = settleDay(candidate, catalog);

  for (const key of Object.keys(world)) delete world[key];
  Object.assign(world, candidate);

  if (eventBus) {
    for (const event of world.domainEvents) {
      if (event.sequence > previousEventSequence) eventBus.publish(event);
    }
  }
  if (typeof onDaySettled === "function") onDaySettled(world, detail);
  return world;
}

function advanceCampaignTime(world, catalog, elapsedGameDays, options = {}) {
  const targetClock = advanceClockTime(world.clock, elapsedGameDays);
  const daysToAdvance = targetClock.day - world.clock.day;
  if (daysToAdvance > MAX_CAMPAIGN_CATCH_UP_DAYS) {
    throw new RangeError(`A single campaign-time update cannot exceed ${MAX_CAMPAIGN_CATCH_UP_DAYS} whole days`);
  }
  for (let index = 0; index < daysToAdvance; index += 1) advanceDay(world, catalog, options);
  world.clock.dayFraction = targetClock.dayFraction;
  return { daysAdvanced: daysToAdvance, dayFraction: world.clock.dayFraction, world };
}

function migrateWorldState(world) {
  if (!world || typeof world !== "object" || Array.isArray(world)) throw new TypeError("Invalid saved world");
  if (![1, 2, 3, 4, 5, 6, GAME_STATE_SCHEMA_VERSION].includes(world.schemaVersion)) {
    throw new Error("Unsupported or invalid game-state schema: " + world.schemaVersion);
  }
  if (!world.clock || typeof world.clock.date !== "string" || !Number.isInteger(world.clock.day)) {
    throw new Error("Saved world has an invalid game clock");
  }
  if (world.schemaVersion === 1) {
    world.clock.dayFraction = 0;
    world.scheduler = { lastRunDayBySystem: {} };
  }
  if (world.clock.dayFraction === undefined) world.clock.dayFraction = 0;
  if (!world.scheduler) world.scheduler = { lastRunDayBySystem: {} };
  if (!world.scheduler.lastRunDayBySystem) world.scheduler.lastRunDayBySystem = {};

  if (world.schemaVersion < 3) {
    const legacySeed = Number.isInteger(world.rng?.seed) ? world.rng.seed : 0x6d2b79f5;
    world.rng = { seed: hashSeed(legacySeed), streams: {} }; world.audit = { calculations: [] }; world.schemaVersion = 3;
  } else {
    if (!world.rng || !world.rng.streams) world.rng = { seed: hashSeed(world.rng?.seed ?? 0x6d2b79f5), streams: {} };
    if (!world.audit || !Array.isArray(world.audit.calculations)) world.audit = { calculations: [] };
  }
  if (world.schemaVersion < 4) { world.domainEventSequence = 0; world.domainEvents = []; world.schemaVersion = 4; }
  if (world.schemaVersion < 5) { world.commandReceipts = []; world.schemaVersion = 5; }
  if (!Array.isArray(world.commandReceipts)) world.commandReceipts = [];
  if (world.schemaVersion < 6) {
    const legacyAccount = world.player?.account || { cash: 0, holdings: {} };
    if (!Number.isFinite(legacyAccount.cash) || legacyAccount.cash < 0 || legacyAccount.cash * 100 > Number.MAX_SAFE_INTEGER) throw new Error("Legacy player cash cannot be migrated safely");
    const positions = legacyAccount.holdings && typeof legacyAccount.holdings === "object" && !Array.isArray(legacyAccount.holdings) ? legacyAccount.holdings : {};
    world.finance = createFinancialLedger({ playerFactionId: world.player.factionId, startDate: world.clock.date, openingDay: world.clock.day, startingBalanceMinor: Math.round(legacyAccount.cash * 100), positions });
    world.player.accountId = "player-main";
    delete world.player.account;
    world.schemaVersion = 6;
  }
  if (world.schemaVersion < 7) {
    if (world.modState === undefined) world.modState = {};
    validateModState(world.modState);
    world.contentHashUpgradePending = true;
    world.schemaVersion = 7;
  }
  return world;
}

function advanceDays(world, catalog, days = 1, options = {}) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_ADVANCE_DAYS) {
    throw new RangeError(`A single time-advance request must be between 1 and ${MAX_ADVANCE_DAYS} days`);
  }
  for (let day = 0; day < days; day += 1) advanceDay(world, catalog, options);
  return world;
}

function createSnapshot(world, catalog) {
  const systems = [...catalog.systems.values()].map((system) => ({
    ...system,
    locations: system.locationIds.map((id) => catalog.locations.get(id))
  }));
  const colonies = [...catalog.colonies.values()].map((definition) => ({
    ...definition,
    state: world.colonies[definition.id],
    faction: catalog.factions.get(definition.factionId),
    location: catalog.locations.get(definition.locationId)
  }));
  const markets = [...catalog.markets.values()].map((definition) => ({
    ...definition,
    state: world.markets[definition.id],
    instruments: [
      ...(definition.commodityIds || []).map((id) => ({
        id, kind: "commodity", name: localized(catalog, catalog.commodities.get(id).nameKey),
        unit: localized(catalog, catalog.commodities.get(id).unitKey), price: world.markets[definition.id].prices[id],
        change: world.markets[definition.id].lastChanges[id] || 0,
        stock: world.colonies[definition.colonyId].stockpiles[id] || 0
      })),
      ...(definition.securityIds || []).map((id) => ({
        id, kind: "equity", name: localized(catalog, catalog.securities.get(id).nameKey),
        ticker: catalog.securities.get(id).ticker, unit: "股",
        price: world.markets[definition.id].prices[id],
        change: world.markets[definition.id].lastChanges[id] || 0
      }))
    ]
  }));
  const fleets = [...catalog.fleets.values()].map((definition) => ({
    ...definition, state: world.fleets[definition.id],
    faction: catalog.factions.get(definition.factionId)
  }));
  const wars = [...catalog.wars.values()].map((definition) => ({
    ...definition, state: world.wars[definition.id]
  }));
  return {
    world,
    universe: catalog.universe,
    localization: catalog.localizations?.[catalog.defaultLocale] || {},
    locale: catalog.defaultLocale || "zh-CN",
    systems,
    factions: [...catalog.factions.values()],
    colonies,
    markets,
    fleets,
    wars,
    commodities: [...catalog.commodities.values()],
    recipes: [...catalog.recipes.values()],
    shipClasses: [...catalog.shipClasses.values()],
    tradeRoutes: [...catalog.tradeRoutes.values()],
    companies: [...catalog.companies.values()],
    recentEvents: [...world.events].slice(-8).reverse()
  };
}

module.exports = {
  GAME_STATE_SCHEMA_VERSION, MAX_ADVANCE_DAYS, MAX_CAMPAIGN_CATCH_UP_DAYS,
  createWorld, advanceDay, advanceCampaignTime, migrateWorldState,
  advanceDays, validateWorldState, createSnapshot
};
