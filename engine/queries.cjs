"use strict";

const { getPopulationTotal } = require("./population.cjs");

const QUERY_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX_QUERY_INPUT_BYTES = 256 * 1024;
const MAX_QUERY_OUTPUT_BYTES = 1024 * 1024;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value, label, maxBytes) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(label + " must be JSON serializable: " + error.message);
  }
  if (typeof serialized !== "string") throw new TypeError(label + " must be JSON serializable");
  if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
    throw new RangeError(label + " exceeds " + maxBytes + " bytes");
  }
  return JSON.parse(serialized);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function detachedSnapshot(value, label, maxBytes) {
  return deepFreeze(cloneJson(value, label, maxBytes));
}

function requireEntity(map, id, label) {
  const entity = map?.get?.(id);
  if (!entity) throw new Error("Unknown " + label + " ID: " + String(id));
  return entity;
}

function requireWorldRecord(map, id, label) {
  const entity = map?.[id];
  if (!entity) throw new Error("World state is missing " + label + ": " + String(id));
  return entity;
}

function createWorldQueryRegistry(definitions = []) {
  if (!Array.isArray(definitions)) throw new TypeError("World query definitions must be an array");
  const queries = new Map();

  function register(definition) {
    if (!isRecord(definition) || typeof definition.id !== "string"
      || !QUERY_ID_PATTERN.test(definition.id) || typeof definition.run !== "function") {
      throw new TypeError("A world query requires a stable ID and run(context) function");
    }
    if (queries.has(definition.id)) throw new Error("Duplicate world query ID: " + definition.id);
    queries.set(definition.id, definition.run);
    return definition.id;
  }

  for (const definition of definitions) register(definition);

  function execute(queryId, world, catalog, payload = {}) {
    if (typeof queryId !== "string" || !QUERY_ID_PATTERN.test(queryId)) {
      throw new TypeError("World query ID must be a stable lowercase identifier");
    }
    if (!queries.has(queryId)) throw new Error("Unknown world query: " + queryId);
    if (!isRecord(payload)) throw new TypeError("World query payload must be an object");
    if (!world || typeof world !== "object" || !catalog) {
      throw new TypeError("World queries require an active world and validated catalog");
    }

    const safePayload = detachedSnapshot(payload, "World query input", MAX_QUERY_INPUT_BYTES);
    const rawResult = queries.get(queryId)({ world, catalog, payload: safePayload });
    return detachedSnapshot(rawResult, "World query result", MAX_QUERY_OUTPUT_BYTES);
  }

  return Object.freeze({
    register,
    execute,
    queryIds: () => [...queries.keys()].sort(),
    has: (queryId) => queries.has(queryId)
  });
}

function createDefaultWorldQueryRegistry() {
  return createWorldQueryRegistry([
    {
      id: "world.overview",
      run: ({ world, catalog }) => ({
        universeId: catalog.universe.id,
        day: world.clock.day,
        date: world.clock.date,
        dayFraction: world.clock.dayFraction,
        factionCount: catalog.factions.size,
        colonyCount: catalog.colonies.size,
        marketCount: catalog.markets.size,
        fleetCount: catalog.fleets.size,
        activeWarCount: [...catalog.wars.keys()].filter((id) => world.wars[id]?.status === "active").length
      })
    },
    {
      id: "colony.summary",
      run: ({ world, catalog, payload }) => {
        const definition = requireEntity(catalog.colonies, payload.colonyId, "colony");
        const state = requireWorldRecord(world.colonies, definition.id, "colony");
        return {
          id: definition.id,
          nameKey: definition.nameKey,
          factionId: definition.factionId,
          locationId: definition.locationId,
          population: getPopulationTotal(state.populationGroups),
          populationGroups: state.populationGroups,
          stability: state.stability,
          stockpiles: state.stockpiles,
          industries: state.industries,
          lastProduction: state.lastProduction
        };
      }
    },
    {
      id: "market.summary",
      run: ({ world, catalog, payload }) => {
        const definition = requireEntity(catalog.markets, payload.marketId, "market");
        const state = requireWorldRecord(world.markets, definition.id, "market");
        const instruments = [
          ...(definition.commodityIds || []).map((id) => ({
            id,
            kind: "commodity",
            basePrice: catalog.commodities.get(id).basePrice,
            price: state.prices[id],
            change: state.lastChanges[id] || 0,
            stock: world.colonies[definition.colonyId]?.stockpiles[id] || 0
          })),
          ...(definition.securityIds || []).map((id) => ({
            id,
            kind: "security",
            basePrice: catalog.securities.get(id).initialPrice,
            price: state.prices[id],
            change: state.lastChanges[id] || 0
          }))
        ];
        return { id: definition.id, colonyId: definition.colonyId, instruments };
      }
    },
    {
      id: "fleet.summary",
      run: ({ world, catalog, payload }) => {
        const definition = requireEntity(catalog.fleets, payload.fleetId, "fleet");
        const state = requireWorldRecord(world.fleets, definition.id, "fleet");
        return {
          id: definition.id,
          factionId: definition.factionId,
          locationId: state.locationId,
          ships: state.ships,
          readiness: state.readiness,
          morale: state.morale,
          stance: state.stance,
          orders: state.orders
        };
      }
    },
    {
      id: "war.summary",
      run: ({ world, catalog, payload }) => {
        const definition = requireEntity(catalog.wars, payload.warId, "war");
        const state = requireWorldRecord(world.wars, definition.id, "war");
        return {
          id: definition.id,
          participants: definition.participants,
          status: state.status,
          daysActive: state.daysActive,
          warWeariness: state.warWeariness
        };
      }
    },
    {
      id: "faction.summary",
      run: ({ world, catalog, payload }) => {
        const definition = requireEntity(catalog.factions, payload.factionId, "faction");
        return {
          id: definition.id,
          nameKey: definition.nameKey,
          colonies: [...catalog.colonies.values()].filter((colony) => colony.factionId === definition.id).map((colony) => ({
            id: colony.id,
            population: world.colonies[colony.id]
              ? getPopulationTotal(world.colonies[colony.id].populationGroups)
              : 0,
            stability: world.colonies[colony.id]?.stability ?? 0
          })),
          fleets: [...catalog.fleets.values()].filter((fleet) => fleet.factionId === definition.id).map((fleet) => ({
            id: fleet.id,
            locationId: world.fleets[fleet.id]?.locationId,
            readiness: world.fleets[fleet.id]?.readiness,
            morale: world.fleets[fleet.id]?.morale
          })),
          wars: [...catalog.wars.values()].filter((war) => war.participants.includes(definition.id)).map((war) => ({
            id: war.id,
            status: world.wars[war.id]?.status
          }))
        };
      }
    }
  ]);
}

module.exports = {
  QUERY_ID_PATTERN,
  MAX_QUERY_INPUT_BYTES,
  MAX_QUERY_OUTPUT_BYTES,
  createWorldQueryRegistry,
  createDefaultWorldQueryRegistry
};
