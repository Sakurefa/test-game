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

function requireFinite(value, label, options = {}) {
  const { min = -Infinity, max = Infinity, integer = false, exclusiveMin = false } = options;
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) ||
      (exclusiveMin ? value <= min : value < min) || value > max) {
    throw new Error(`Invalid numeric value for ${label}: ${String(value)}`);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
}

function requireUnique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate entries`);
}

function requireGameDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date for ${label}: ${value}`);
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
  if (typeof universe.nameKey !== "string" || !universe.nameKey.trim()) throw new Error("Universe requires a localization nameKey");
  requireGameDate(universe.startDate, "universe.startDate");
  requireReference(catalog.factions, universe.defaultPlayerFactionId, "universe default player faction");

  for (const system of catalog.systems.values()) {
    if (typeof system.nameKey !== "string" || !system.nameKey.trim()) throw new Error(`System ${system.id} requires a localization nameKey`);
    if (!isRecord(system.position)) throw new Error(`System ${system.id} requires a position`);
    requireFinite(system.position.x, `system ${system.id} position.x`);
    requireFinite(system.position.y, `system ${system.id} position.y`);
    requireArray(system.links, `system ${system.id} links`);
    requireArray(system.locationIds, `system ${system.id} locationIds`);
    requireUnique(system.links, `system ${system.id} links`);
    requireUnique(system.locationIds, `system ${system.id} locationIds`);
    if (system.links.includes(system.id)) throw new Error(`System ${system.id} cannot link to itself`);
    for (const linkedId of system.links) requireReference(catalog.systems, linkedId, `system link ${system.id} -> ${linkedId}`);
    if (system.factionId) requireReference(catalog.factions, system.factionId, `system faction ${system.id}`);
    for (const locationId of system.locationIds) {
      requireReference(catalog.locations, locationId, `system location ${system.id}`);
      if (catalog.locations.get(locationId).systemId !== system.id) {
        throw new Error(`Location ${locationId} does not belong to system ${system.id}`);
      }
    }
  }
  for (const location of catalog.locations.values()) {
    requireReference(catalog.systems, location.systemId, `location system ${location.id}`);
    if (!["star", "planet", "station", "moon", "asteroid", "gate"].includes(location.type)) {
      throw new Error(`Invalid location type for ${location.id}`);
    }
    if (location.factionId) requireReference(catalog.factions, location.factionId, `location faction ${location.id}`);
    if (location.colonyId) requireReference(catalog.colonies, location.colonyId, `location colony ${location.id}`);
  }
  for (const route of catalog.tradeRoutes.values()) {
    requireReference(catalog.systems, route.fromSystemId, `route origin ${route.id}`);
    requireReference(catalog.systems, route.toSystemId, `route destination ${route.id}`);
    if (route.fromSystemId === route.toSystemId) throw new Error(`Trade route ${route.id} cannot loop to itself`);
    const origin = catalog.systems.get(route.fromSystemId);
    const destination = catalog.systems.get(route.toSystemId);
    if (!origin.links.includes(destination.id) || !destination.links.includes(origin.id)) {
      throw new Error(`Trade route ${route.id} must match a declared bidirectional system link`);
    }
    requireFinite(route.travelDays, `route ${route.id} travelDays`, { min: 1, integer: true });
    requireFinite(route.risk, `route ${route.id} risk`, { min: 0, max: 1 });
    requireFinite(route.capacity, `route ${route.id} capacity`, { min: 0 });
  }
  for (const colony of catalog.colonies.values()) {
    requireReference(catalog.locations, colony.locationId, `colony location ${colony.id}`);
    requireReference(catalog.factions, colony.factionId, `colony faction ${colony.id}`);
    requireFinite(colony.population, `colony ${colony.id} population`, { min: 0 });
    requireFinite(colony.stability, `colony ${colony.id} stability`, { min: 0, max: 100 });
    if (catalog.locations.get(colony.locationId).colonyId !== colony.id) {
      throw new Error(`Colony ${colony.id} and its location reference each other inconsistently`);
    }
    if (!isRecord(colony.stockpiles)) throw new Error(`Colony ${colony.id} requires a stockpiles object`);
    requireArray(colony.industries, `colony ${colony.id} industries`);
    for (const [commodityId, quantity] of Object.entries(colony.stockpiles)) {
      requireReference(catalog.commodities, commodityId, `stockpile ${colony.id}`);
      requireFinite(quantity, `stockpile ${colony.id}.${commodityId}`, { min: 0 });
    }
    for (const industry of colony.industries) {
      requireReference(catalog.recipes, industry.recipeId, `industry recipe ${colony.id}`);
      requireFinite(industry.level, `industry level ${colony.id}.${industry.recipeId}`, { min: 1, max: 20, integer: true });
      if (industry.companyId) requireReference(catalog.companies, industry.companyId, `industry operator ${colony.id}`);
    }
  }
  for (const commodity of catalog.commodities.values()) {
    requireFinite(commodity.basePrice, `commodity ${commodity.id} basePrice`, { min: 0, exclusiveMin: true });
    requireFinite(commodity.targetStock, `commodity ${commodity.id} targetStock`, { min: 0, exclusiveMin: true });
    requireFinite(commodity.priceElasticity, `commodity ${commodity.id} priceElasticity`, { min: 0, max: 10 });
    requireFinite(commodity.volatility, `commodity ${commodity.id} volatility`, { min: 0, max: 1 });
    if (typeof commodity.unitKey !== "string" || !commodity.unitKey.trim()) throw new Error(`Commodity ${commodity.id} requires a localization unitKey`);
  }
  for (const recipe of catalog.recipes.values()) {
    requireArray(recipe.inputs, `recipe ${recipe.id} inputs`);
    requireArray(recipe.outputs, `recipe ${recipe.id} outputs`);
    if (recipe.outputs.length === 0) throw new Error(`Recipe ${recipe.id} must produce at least one output`);
    for (const input of recipe.inputs) {
      requireReference(catalog.commodities, input.commodityId, `recipe input ${recipe.id}`);
      requireFinite(input.quantity, `recipe input ${recipe.id} quantity`, { min: 0, exclusiveMin: true });
    }
    for (const output of recipe.outputs) {
      requireReference(catalog.commodities, output.commodityId, `recipe output ${recipe.id}`);
      requireFinite(output.quantity, `recipe output ${recipe.id} quantity`, { min: 0, exclusiveMin: true });
    }
    if (recipe.workforce !== undefined) requireFinite(recipe.workforce, `recipe ${recipe.id} workforce`, { min: 0 });
  }
  for (const company of catalog.companies.values()) {
    requireReference(catalog.factions, company.factionId, `company faction ${company.id}`);
    requireArray(company.colonyIds, `company ${company.id} colonyIds`);
    requireUnique(company.colonyIds, `company ${company.id} colonyIds`);
    for (const colonyId of company.colonyIds) requireReference(catalog.colonies, colonyId, `company colony ${company.id}`);
  }
  for (const security of catalog.securities.values()) {
    requireReference(catalog.companies, security.issuerId, `security issuer ${security.id}`);
    requireFinite(security.initialPrice, `security ${security.id} initialPrice`, { min: 0, exclusiveMin: true });
    requireFinite(security.volatility, `security ${security.id} volatility`, { min: 0, max: 1 });
  }
  for (const market of catalog.markets.values()) {
    requireReference(catalog.colonies, market.colonyId, `market colony ${market.id}`);
    requireArray(market.commodityIds, `market ${market.id} commodityIds`);
    requireArray(market.securityIds, `market ${market.id} securityIds`);
    requireUnique(market.commodityIds, `market ${market.id} commodityIds`);
    requireUnique(market.securityIds, `market ${market.id} securityIds`);
    for (const commodityId of market.commodityIds) requireReference(catalog.commodities, commodityId, `market commodity ${market.id}`);
    for (const securityId of market.securityIds) requireReference(catalog.securities, securityId, `market security ${market.id}`);
  }
  for (const shipClass of catalog.shipClasses.values()) {
    requireFinite(shipClass.strength, `ship class ${shipClass.id} strength`, { min: 0 });
    requireFinite(shipClass.crew, `ship class ${shipClass.id} crew`, { min: 0, integer: true });
    requireFinite(shipClass.speed, `ship class ${shipClass.id} speed`, { min: 0, exclusiveMin: true });
    requireFinite(shipClass.supplyUse, `ship class ${shipClass.id} supplyUse`, { min: 0 });
  }
  for (const fleet of catalog.fleets.values()) {
    requireReference(catalog.factions, fleet.factionId, `fleet faction ${fleet.id}`);
    requireReference(catalog.locations, fleet.locationId, `fleet location ${fleet.id}`);
    requireArray(fleet.ships, `fleet ${fleet.id} ships`);
    requireFinite(fleet.readiness ?? 100, `fleet ${fleet.id} readiness`, { min: 0, max: 100 });
    requireFinite(fleet.morale ?? 70, `fleet ${fleet.id} morale`, { min: 0, max: 100 });
    for (const ship of fleet.ships) {
      requireReference(catalog.shipClasses, ship.shipClassId, `fleet ship ${fleet.id}`);
      requireFinite(ship.quantity, `fleet ${fleet.id} ship quantity`, { min: 1, integer: true });
    }
  }
  for (const event of catalog.events.values()) {
    if (typeof event.nameKey !== "string" || !event.nameKey.trim()) throw new Error(`Event ${event.id} requires a localization nameKey`);
    requireFinite(event.weight, `event ${event.id} weight`, { min: 0 });
    if (event.tags !== undefined) {
      requireArray(event.tags, `event ${event.id} tags`);
      if (event.tags.some((tag) => typeof tag !== "string")) throw new Error(`Event ${event.id} tags must be strings`);
    }
  }
  for (const war of catalog.wars.values()) {
    requireArray(war.participants, `war ${war.id} participants`);
    if (war.participants.length < 2) throw new Error(`War ${war.id} requires at least two participants`);
    requireUnique(war.participants, `war ${war.id} participants`);
    if (!["active", "cold", "ended"].includes(war.status)) throw new Error(`Invalid status for war ${war.id}`);
    requireGameDate(war.startedOn || universe.startDate, `war ${war.id} startedOn`);
    for (const factionId of war.participants) requireReference(catalog.factions, factionId, `war participant ${war.id}`);
    requireArray(war.fleetIds || [], `war ${war.id} fleetIds`);
    for (const fleetId of war.fleetIds || []) {
      requireReference(catalog.fleets, fleetId, `war fleet ${war.id}`);
      if (!war.participants.includes(catalog.fleets.get(fleetId).factionId)) {
        throw new Error(`Fleet ${fleetId} does not belong to a participant in war ${war.id}`);
      }
    }
  }
  return universe;
}

function collectLocalizations(modPackages) {
  const localizations = {};
  for (const mod of modPackages.filter((item) => item.enabled !== false && !item.error)
    .slice().sort((a, b) => a.id === "core" ? -1 : b.id === "core" ? 1 : a.id.localeCompare(b.id))) {
    for (const [file, data] of Object.entries(mod.data?.localization || {})) {
      const locale = data?.language?.locale;
      if (typeof locale !== "string" || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale)) {
        throw new Error(`${mod.id}/localization/${file}: missing or invalid [language].locale`);
      }
      if (!localizations[locale]) localizations[locale] = {};
      const entries = data.content;
      if (!isRecord(entries)) throw new Error(`${mod.id}/localization/${file}: missing [content] section`);
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid localized string: ${locale}.${key}`);
        localizations[locale][key] = value;
      }
    }
  }
  if (!localizations["zh-CN"] || Object.keys(localizations["zh-CN"]).length === 0) {
    throw new Error("Core Mod must provide zh-CN content localization");
  }
  return localizations;
}

function validateLocalizationReferences(catalog, localizations, locale) {
  const strings = localizations[locale] || {};
  for (const collectionName of Object.values(DEFINITION_TYPES)) {
    for (const entity of catalog[collectionName].values()) {
      for (const field of ["nameKey", "descriptionKey", "governmentKey", "unitKey"]) {
        const key = entity[field];
        if (field === "nameKey" && (typeof key !== "string" || !key.trim())) {
          throw new Error(`Definition ${entity.id} requires a localization nameKey`);
        }
        if (key !== undefined && (typeof key !== "string" || !Object.hasOwn(strings, key))) {
          throw new Error(`Missing localization key ${String(key)} referenced by ${entity.id}.${field} in locale ${locale}`);
        }
      }
    }
  }
}

function compileCatalog(modPackages) {
  try {
    if (!Array.isArray(modPackages)) throw new TypeError("Mod packages must be an array");
    const localizations = collectLocalizations(modPackages);
    const defaultLocale = "zh-CN";
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
        if (file === "definitions.ini") {
          if (!Array.isArray(data.entries)) throw new Error(`${mod.id}/${file}: entries must be an array`);
          registryEntries.push(...data.entries);
        }
      }
    }

    const universe = validateCatalog(catalog, registryEntries);
    validateLocalizationReferences(catalog, localizations, defaultLocale);
    const serializable = {};
    for (const [name, collection] of Object.entries(catalog)) {
      serializable[name] = [...collection.values()].map(({ _type, _source, ...entity }) => entity);
    }
    const extensions = enabled
      .filter((mod) => Object.keys(mod.hooks || {}).length > 0)
      .map((mod) => ({
        id: mod.id,
        version: mod.version,
        scripts: mod.scripts || {},
        hooks: mod.hooks || {}
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const legacyContentHash = crypto.createHash("sha256").update(JSON.stringify(serializable)).digest("hex");
    const contentFingerprint = extensions.length > 0
      ? JSON.stringify({ content: serializable, extensions })
      : JSON.stringify(serializable);
    const contentHash = crypto.createHash("sha256").update(contentFingerprint).digest("hex");
    return {
      ok: true,
      catalog: { ...catalog, universe, contentHash, legacyContentHash, serializable, localizations, defaultLocale, extensions }
    };
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

module.exports = { DEFINITION_TYPES, compileCatalog, validateCatalog, validateLocalizationReferences, collectLocalizations, toPlainCatalog };
