const { NamedRandomStreams, hashSeed } = require("./random.cjs");
const { createCalculationService, CALCULATION_AUDIT_LIMIT } = require("./formulas.cjs");
const { createClock, advanceClock, advanceClockTime } = require("./clock.cjs");
const { createSystemRegistry } = require("./system-registry.cjs");

const GAME_STATE_SCHEMA_VERSION = 3;
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
      lastProduction: {}
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
    player: {
      factionId: options.playerFactionId || catalog.universe.defaultPlayerFactionId,
      account: { cash: 250000, holdings: {} }
    },
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

function produceForColony(catalog, colonyState) {
  const output = {};
  for (const industry of colonyState.industries) {
    const recipe = catalog.recipes.get(industry.recipeId);
    const efficiency = clamp(colonyState.stability / 100, 0.1, 1);
    let batchScale = industry.level * efficiency;
    for (const input of recipe.inputs || []) {
      const available = colonyState.stockpiles[input.commodityId] || 0;
      batchScale = Math.min(batchScale, available / input.quantity);
    }
    batchScale = Math.max(0, batchScale);
    if (batchScale <= 0) continue;

    for (const input of recipe.inputs || []) {
      const consumed = input.quantity * batchScale;
      colonyState.stockpiles[input.commodityId] = round(
        Math.max(0, (colonyState.stockpiles[input.commodityId] || 0) - consumed), 3
      );
    }
    for (const item of recipe.outputs || []) {
      const produced = item.quantity * batchScale;
      colonyState.stockpiles[item.commodityId] = round(
        (colonyState.stockpiles[item.commodityId] || 0) + produced, 3
      );
      output[item.commodityId] = round((output[item.commodityId] || 0) + produced, 3);
    }
  }
  colonyState.lastProduction = output;
  return output;
}

function updateMarket(catalog, marketState, colonyState, allColonyStates, randomStreams, calculations, day) {
  const market = catalog.markets.get(marketState.id);
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
      previousPrice: previous
    }, { random: randomStreams.get(streamId), randomStreamId: streamId, day });
    marketState.prices[securityId] = result.price;
    changes[securityId] = result.change;
  }
  marketState.lastChanges = changes;
  return changes;
}


const simulationSystems = createSystemRegistry([
  {
    id: "colonies.production",
    cadence: "weekly",
    order: 10,
    update: ({ world, catalog, summary }) => {
      for (const [colonyId, colonyState] of Object.entries(world.colonies)) {
        summary.production[colonyId] = produceForColony(catalog, colonyState);
      }
    }
  },
  {
    id: "economy.market-pricing",
    cadence: "daily",
    order: 20,
    dependsOn: ["colonies.production"],
    update: ({ world, catalog, randomStreams, calculations, summary, day }) => {
      for (const marketState of Object.values(world.markets)) {
        const definition = catalog.markets.get(marketState.id);
        summary.market[marketState.id] = updateMarket(
          catalog, marketState, world.colonies[definition.colonyId], world.colonies, randomStreams, calculations, day
        );
      }
    }
  },
  {
    id: "military.war-chronology",
    cadence: "daily",
    order: 30,
    update: ({ world }) => {
      for (const war of Object.values(world.wars)) {
        if (war.status === "active") war.daysActive += 1;
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
    throw new Error("This save was created with different Mod content. Restore the matching Mods before loading.");
  }
  if (world.universeId !== catalog.universe.id) throw new Error("Save universe does not match the loaded content");
  if (!Number.isInteger(world.rng?.seed) || !world.rng?.streams || typeof world.rng.streams !== "object" || Array.isArray(world.rng.streams)) {
    throw new Error("Save has an invalid named random state");
  }
  new NamedRandomStreams(world.rng.seed, world.rng.streams);
  if (!world.audit || !Array.isArray(world.audit.calculations)) throw new Error("Save has an invalid calculation audit");
  if (!world.clock || typeof world.clock.date !== "string" || !Number.isInteger(world.clock.day)
    || !Number.isFinite(world.clock.dayFraction) || world.clock.dayFraction < 0 || world.clock.dayFraction >= 1) {
    throw new Error("Save has an invalid game clock");
  }
  if (!world.scheduler || typeof world.scheduler !== "object" || !world.scheduler.lastRunDayBySystem
    || typeof world.scheduler.lastRunDayBySystem !== "object") throw new Error("Save has an invalid simulation scheduler state");
  for (const id of catalog.colonies.keys()) {
    if (!world.colonies?.[id] || !world.colonies[id].stockpiles) throw new Error(`Save is missing colony state: ${id}`);
  }
  for (const id of catalog.markets.keys()) {
    if (!world.markets?.[id] || !world.markets[id].prices) throw new Error(`Save is missing market state: ${id}`);
  }
  for (const id of catalog.fleets.keys()) {
    if (!world.fleets?.[id]) throw new Error(`Save is missing fleet state: ${id}`);
  }
  return true;
}

function advanceDay(world, catalog) {
  validateWorldState(world, catalog);
  const randomStreams = new NamedRandomStreams(world.rng.seed, world.rng.streams);
  const calculations = createCalculationService();
  world.clock = advanceClock(world.clock, 1);
  const summary = { production: {}, market: {} };
  const systemsRun = simulationSystems.runDue({
    world,
    day: world.clock.day,
    context: { catalog, randomStreams, calculations, summary }
  });

  world.rng = randomStreams.snapshot();
  if (!world.audit || typeof world.audit !== "object") world.audit = { calculations: [] };
  if (!Array.isArray(world.audit.calculations)) world.audit.calculations = [];
  world.audit.calculations.push(...calculations.getRecords());
  if (world.audit.calculations.length > CALCULATION_AUDIT_LIMIT) {
    world.audit.calculations.splice(0, world.audit.calculations.length - CALCULATION_AUDIT_LIMIT);
  }
  const productionCount = Object.keys(summary.production).length;
  const marketCount = Object.keys(summary.market).length;
  const report = productionCount > 0
    ? `第 ${world.clock.day} 天结束：${productionCount} 个殖民地完成每周生产，${marketCount} 个市场更新报价。`
    : `第 ${world.clock.day} 天结束：${marketCount} 个市场更新报价。`;
  appendEvent(world, {
    id: `day-${world.clock.day}`,
    day: world.clock.day,
    date: world.clock.date,
    type: "daily-report",
    text: report,
    production: summary.production,
    marketChanges: summary.market,
    systemsRun
  });
  return world;
}

function advanceCampaignTime(world, catalog, elapsedGameDays) {
  validateWorldState(world, catalog);
  const targetClock = advanceClockTime(world.clock, elapsedGameDays);
  const daysToAdvance = targetClock.day - world.clock.day;
  if (daysToAdvance > MAX_CAMPAIGN_CATCH_UP_DAYS) {
    throw new RangeError(`A single campaign-time update cannot exceed ${MAX_CAMPAIGN_CATCH_UP_DAYS} whole days`);
  }
  for (let index = 0; index < daysToAdvance; index += 1) advanceDay(world, catalog);
  world.clock.dayFraction = targetClock.dayFraction;
  return { daysAdvanced: daysToAdvance, dayFraction: world.clock.dayFraction, world };
}

function migrateWorldState(world) {
  if (!world || typeof world !== "object" || Array.isArray(world)) throw new TypeError("Invalid saved world");
  if (![1, 2, GAME_STATE_SCHEMA_VERSION].includes(world.schemaVersion)) {
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
    // Legacy saves used one shared stream. New streams derive independently from seed + stable ID.
    world.rng = { seed: hashSeed(legacySeed), streams: {} };
    world.audit = { calculations: [] };
    world.schemaVersion = GAME_STATE_SCHEMA_VERSION;
  } else {
    if (!world.rng || !world.rng.streams) world.rng = { seed: hashSeed(world.rng?.seed ?? 0x6d2b79f5), streams: {} };
    if (!world.audit || !Array.isArray(world.audit.calculations)) world.audit = { calculations: [] };
  }
  return world;
}

function advanceDays(world, catalog, days = 1) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_ADVANCE_DAYS) {
    throw new RangeError(`A single time-advance request must be between 1 and ${MAX_ADVANCE_DAYS} days`);
  }
  for (let day = 0; day < days; day += 1) advanceDay(world, catalog);
  return world;
}

function createSnapshot(world, catalog) {
  validateWorldState(world, catalog);
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
