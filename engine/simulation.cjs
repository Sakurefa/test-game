const { SeededRandom, hashSeed } = require("./random.cjs");
const { createClock, advanceClock } = require("./clock.cjs");

const GAME_STATE_SCHEMA_VERSION = 1;
const MAX_ADVANCE_DAYS = 30;
const LOG_LIMIT = 100;

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
  const random = new SeededRandom(seed);
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
    rng: random.snapshot(),
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
      text: `新航程在${catalog.universe.name}展开。`
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

function updateMarket(catalog, marketState, colonyState, allColonyStates, random) {
  const market = catalog.markets.get(marketState.id);
  const changes = {};
  for (const commodityId of market.commodityIds || []) {
    const commodity = catalog.commodities.get(commodityId);
    const stock = colonyState.stockpiles[commodityId] || 0;
    const scarcity = clamp((commodity.targetStock - stock) / commodity.targetStock, -1, 1.5);
    const fundamentals = commodity.basePrice * clamp(1 + scarcity * commodity.priceElasticity, 0.25, 3.5);
    const noise = (random.next() - 0.5) * commodity.volatility;
    const previous = marketState.prices[commodityId] ?? commodity.basePrice;
    const target = Math.max(0.01, fundamentals * (1 + noise));
    const next = round(previous + (target - previous) * 0.18, 3);
    marketState.prices[commodityId] = next;
    changes[commodityId] = round((next - previous) / previous * 100, 2);
  }

  for (const securityId of market.securityIds || []) {
    const security = catalog.securities.get(securityId);
    const issuer = catalog.companies.get(security.issuerId);
    const outputValue = issuer.colonyIds.reduce((sum, colonyId) => {
      const production = allColonyStates[colonyId]?.lastProduction || {};
      return sum + Object.values(production).reduce((total, quantity) => total + quantity, 0);
    }, 0);
    const operationalDrift = clamp(outputValue * 0.00001, 0, 0.003);
    const previous = marketState.prices[securityId] ?? security.initialPrice;
    const noise = (random.next() - 0.5) * security.volatility;
    const next = round(Math.max(0.01, previous * (1 + noise + operationalDrift)), 3);
    marketState.prices[securityId] = next;
    changes[securityId] = round((next - previous) / previous * 100, 2);
  }
  marketState.lastChanges = changes;
  return changes;
}

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
  if (!Number.isInteger(world.rng?.state) || !Number.isInteger(world.rng?.seed)) throw new Error("Save has an invalid random state");
  if (!world.clock || typeof world.clock.date !== "string" || !Number.isInteger(world.clock.day)) throw new Error("Save has an invalid game clock");
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
  const random = new SeededRandom(world.rng.seed, world.rng.state);
  const nextClock = advanceClock(world.clock, 1);
  const productionSummary = {};

  for (const [colonyId, colonyState] of Object.entries(world.colonies)) {
    productionSummary[colonyId] = produceForColony(catalog, colonyState);
  }

  const marketSummary = {};
  for (const marketState of Object.values(world.markets)) {
    const definition = catalog.markets.get(marketState.id);
    marketSummary[marketState.id] = updateMarket(
      catalog, marketState, world.colonies[definition.colonyId], world.colonies, random
    );
  }

  for (const war of Object.values(world.wars)) {
    if (war.status === "active") war.daysActive += 1;
  }

  world.clock = nextClock;
  world.rng = random.snapshot();
  appendEvent(world, {
    id: `day-${world.clock.day}`,
    day: world.clock.day,
    date: world.clock.date,
    type: "daily-report",
    text: `第 ${world.clock.day} 天结束：${Object.keys(world.colonies).length} 个殖民地完成生产，${Object.keys(world.markets).length} 个市场更新报价。`,
    production: productionSummary,
    marketChanges: marketSummary
  });
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
        id, kind: "commodity", name: catalog.localizations?.[catalog.defaultLocale]?.[catalog.commodities.get(id).nameKey] || id,
        unit: catalog.commodities.get(id).unit, price: world.markets[definition.id].prices[id],
        change: world.markets[definition.id].lastChanges[id] || 0,
        stock: world.colonies[definition.colonyId].stockpiles[id] || 0
      })),
      ...(definition.securityIds || []).map((id) => ({
        id, kind: "equity", name: catalog.localizations?.[catalog.defaultLocale]?.[catalog.securities.get(id).nameKey] || id,
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
    universe: catalog.universe,\n    localization: catalog.localizations?.[catalog.defaultLocale] || {},\n    locale: catalog.defaultLocale || "zh-CN",
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
  GAME_STATE_SCHEMA_VERSION, MAX_ADVANCE_DAYS, createWorld, advanceDay,
  advanceDays, validateWorldState, createSnapshot
};
