const crypto = require("node:crypto");

const DEFINITION_TYPES = Object.freeze({
  universe: "universes",
  star_system: "systems",
  location: "locations",
  trade_route: "tradeRoutes",
  faction: "factions",
  colony: "colonies",
  commodity: "commodities",
  recipe: "recipes",
  market: "markets",
  company: "companies",
  security: "securities",
  ship_class: "shipClasses",
  fleet: "fleets",
  war: "wars",
  event: "events"
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addEntity(collection, entity, type, source) {
  if (!isRecord(entity) || typeof entity.id !== "string" || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(entity.id)) {
    throw new Error(`Invalid ${type} definition in ${source}`);
  }
  if (collection.has(entity.id)) throw new Error(`Duplicate content ID: ${entity.id}`);
  collection.set(entity.id, { ...entity, _type: type, _source: source });
}

function requireReference(collection, id, label) {
  if (typeof id !== "string" || !collection.has(id)) {
    throw new Error(`Unresolved reference ${label}: ${String(id)}`);
  }
}

function validateCatalog(catalog, registryEntries) {
  const registry = new Map();
  for (const entry of registryEntries) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !Object.hasOwn(DEFINITION_TYPES, entry.type)) {
      throw new Error("Registry entries require a valid id and supported type");
    }
    if (registry.has(entry.id)) throw new Error(`Duplicate registry ID: ${entry.id}`);
    registry.set(entry.id, entry.type);
  }

  for (const [type, collectionName] of Object.entries(DEFINITION_TYPES)) {
    for (const entity of catalog[collectionName].values()) {
      if (registry.get(entity.id) !== type) {
        throw new Error(`Definition ${entity.id} is missing a matching registry entry of type ${type}`);
      }
    }
  }
  for (const [id, type] of registry) {
    const entity = catalog[DEFINITION_TYPES[type]].get(id);
    if (!entity) throw new Error(`Registry entry ${id} (${type}) has no content definition`);
  }

  const universe = catalog.universes.values().next().value;
  if (!universe) throw new Error("No universe definition was provided");
  if (catalog.universes.size !== 1) throw new Error("Exactly one universe definition is required");

  for (const system of catalog.systems.values()) {
    for (const linkedId of system.links || []) requireReference(catalog.systems, linkedId, `system link ${system.id} -> ${linkedId}`);
    if (system.factionId) requireReference(catalog.factions, system.factionId, `system faction ${system.id}`);
  }
  for (const location of catalog.locations.values()) {
    requireReference(catalog.systems, location.systemId, `location system ${location.id}`);
    if (location.factionId) requireReference(catalog.factions, location.factionId, `location faction ${location.id}`);
    if (location.colonyId) requireReference(catalog.colonies, location.colonyId, `location colony ${location.id}`);
  }
  for (const route of catalog.tradeRoutes.values()) {
    requireReference(catalog.systems, route.fromSystemId, `route origin ${route.id}`);
    requireReference(catalog.systems, route.toSystemId, `route destination ${route.id}`);
    if (route.fromSystemId === route.toSystemId) throw new Error(`Trade route ${route.id} cannot loop to itself`);
  }
  for (const colony of catalog.colonies.values()) {
    requireReference(catalog.locations, colony.locationId, `colony location ${colony.id}`);
    requireReference(catalog.factions, colony.factionId, `colony faction ${colony.id}`);
    for (const [commodityId, quantity] of Object.entries(colony.stockpiles || {})) {
      requireReference(catalog.commodities, commodityId, `stockpile ${colony.id}`);
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error(`Invalid stockpile quantity ${colony.id}.${commodityId}`);
    }
    for (const industry of colony.industries || []) {
      requireReference(catalog.recipes, industry.recipeId, `industry recipe ${colony.id}`);
      if (!Number.isInteger(industry.level) || industry.level < 1 || industry.level > 20) {
        throw new Error(`Invalid industry level ${colony.id}.${industry.recipeId}`);
      }
      if (industry.companyId) requireReference(catalog.companies, industry.companyId, `industry operator ${colony.id}`);
    }
  }
  for (const recipe of catalog.recipes.values()) {
    for (const input of recipe.inputs || []) requireReference(catalog.commodities, input.commodityId, `recipe input ${recipe.id}`);
    for (const output of recipe.outputs || []) requireReference(catalog.commodities, output.commodityId, `recipe output ${recipe.id}`);
  }
  for (const company of catalog.companies.values()) {
    requireReference(catalog.factions, company.factionId, `company faction ${company.id}`);
    for (const colonyId of company.colonyIds || []) requireReference(catalog.colonies, colonyId, `company colony ${company.id}`);
  }
  for (const security of catalog.securities.values()) {
    requireReference(catalog.companies, security.issuerId, `security issuer ${security.id}`);
    if (!Number.isFinite(security.initialPrice) || security.initialPrice <= 0) {
      throw new Error(`Invalid initial price for security ${security.id}`);
    }
  }
  for (const market of catalog.markets.values()) {
    requireReference(catalog.colonies, market.colonyId, `market colony ${market.id}`);
    for (const commodityId of market.commodityIds || []) requireReference(catalog.commodities, commodityId, `market commodity ${market.id}`);
    for (const securityId of market.securityIds || []) requireReference(catalog.securities, securityId, `market security ${market.id}`);
  }
  for (const fleet of catalog.fleets.values()) {
    requireReference(catalog.factions, fleet.factionId, `fleet faction ${fleet.id}`);
    requireReference(catalog.locations, fleet.locationId, `fleet location ${fleet.id}`);
    for (const ship of fleet.ships || []) requireReference(catalog.shipClasses, ship.shipClassId, `fleet ship ${fleet.id}`);
  }
  for (const war of catalog.wars.values()) {
    if (!Array.isArray(war.participants) || war.participants.length < 2) throw new Error(`War ${war.id} requires at least two participants`);
    for (const factionId of war.participants) requireReference(catalog.factions, factionId, `war participant ${war.id}`);
    for (const fleetId of war.fleetIds || []) requireReference(catalog.fleets, fleetId, `war fleet ${war.id}`);
  }
  return universe;
}

function compileCatalog(modPackages) {
  try {
    if (!Array.isArray(modPackages)) throw new TypeError("Mod packages must be an array");
    const catalog = {};
    for (const collectionName of Object.values(DEFINITION_TYPES)) catalog[collectionName] = new Map();
    const registryEntries = [];
    const enabled = modPackages.filter((mod) => mod.enabled !== false && !mod.error)
      .slice().sort((a, b) => a.id === "core" ? -1 : b.id === "core" ? 1 : a.id.localeCompare(b.id));
    if (!enabled.some((mod) => mod.id === "core")) throw new Error("Required core Mod is not enabled or is invalid");

    for (const mod of enabled) {
      const contentFiles = mod.data?.content || {};
      for (const [file, data] of Object.entries(contentFiles)) {
        if (!isRecord(data)) continue;
        for (const [type, collectionName] of Object.entries(DEFINITION_TYPES)) {
          if (type === "universe" && isRecord(data.universe)) {
            addEntity(catalog[collectionName], data.universe, type, `${mod.id}/${file}`);
          } else {
            const sourceName = type === "star_system" ? "systems"
              : type === "trade_route" ? "tradeRoutes"
              : type === "ship_class" ? "shipClasses"
              : collectionName;
            const definitions = data[sourceName];
            if (definitions === undefined) continue;
            if (!Array.isArray(definitions)) throw new Error(`${mod.id}/${file}: ${sourceName} must be an array`);
            for (const entity of definitions) addEntity(catalog[collectionName], entity, type, `${mod.id}/${file}`);
          }
        }
      }
      for (const [file, data] of Object.entries(mod.data?.registry || {})) {
        if (file === "definitions.json") {
          if (!Array.isArray(data.entries)) throw new Error(`${mod.id}/${file}: entries must be an array`);
          registryEntries.push(...data.entries);
        }
      }
    }

    const universe = validateCatalog(catalog, registryEntries);
    const serializable = {};
    for (const [name, collection] of Object.entries(catalog)) {
      serializable[name] = [...collection.values()].map(({ _type, _source, ...entity }) => entity);
    }
    const contentHash = crypto.createHash("sha256").update(JSON.stringify(serializable)).digest("hex");
    return { ok: true, catalog: { ...catalog, universe, contentHash, serializable } };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function toPlainCatalog(catalog) {
  const output = {};
  for (const [name, collection] of Object.entries(catalog)) {
    if (collection instanceof Map) {
      output[name] = [...collection.values()].map(({ _type, _source, ...entity }) => entity);
    }
  }
  return output;
}

module.exports = { DEFINITION_TYPES, compileCatalog, validateCatalog, toPlainCatalog };
