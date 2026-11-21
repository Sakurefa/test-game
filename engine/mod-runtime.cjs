"use strict";

const vm = require("node:vm");

const MOD_HOOK_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MOD_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const MOD_EVENT_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX_MOD_HOOKS = 64;
const MAX_MOD_EFFECTS = 128;
const MAX_MOD_EVENTS = 64;
const MAX_MOD_HOOK_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_MOD_OUTPUT_BYTES = 128 * 1024;
const MAX_MOD_STATE_BYTES = 64 * 1024;
const MAX_MOD_STATE_KEYS = 128;
const DEFAULT_MOD_TIMEOUT_MS = 50;
const MAX_MOD_TIMEOUT_MS = 100;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function requireFinite(value, label, limit = 1e12) {
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new TypeError(label + " must be a finite number within the supported range");
  }
  return value;
}

function cloneJson(value, label) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(label + " must contain JSON-safe values: " + error.message);
  }
  if (typeof serialized !== "string") throw new TypeError(label + " must be JSON serializable");
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > MAX_MOD_HOOK_INPUT_BYTES) throw new RangeError(label + " exceeds the " + MAX_MOD_HOOK_INPUT_BYTES + " byte limit");
  return { value: JSON.parse(serialized), serialized };
}

function normalizeHookResult(value, modId, hookId) {
  if (value === undefined || value === null) value = {};
  if (!isRecord(value)) throw new TypeError("Mod " + modId + " hook " + hookId + " must return an object");
  if (Object.keys(value).some((key) => key !== "effects" && key !== "events")) {
    throw new TypeError("Mod " + modId + " hook " + hookId + " returned an unsupported result field");
  }
  const effects = value.effects ?? [];
  const events = value.events ?? [];
  if (!Array.isArray(effects) || effects.length > MAX_MOD_EFFECTS) {
    throw new RangeError("Mod " + modId + " hook " + hookId + " exceeded the effect limit");
  }
  if (!Array.isArray(events) || events.length > MAX_MOD_EVENTS) {
    throw new RangeError("Mod " + modId + " hook " + hookId + " exceeded the event limit");
  }
  for (const [index, effect] of effects.entries()) {
    if (!isRecord(effect) || typeof effect.type !== "string" || !MOD_HOOK_PATTERN.test(effect.type)
      || !isRecord(effect.payload)) {
      throw new TypeError("Mod " + modId + " hook " + hookId + " returned an invalid effect at index " + index);
    }
  }
  for (const [index, event] of events.entries()) {
    if (!isRecord(event) || typeof event.type !== "string" || event.type.length > 48
      || !MOD_EVENT_PATTERN.test(event.type) || !isRecord(event.payload ?? {})) {
      throw new TypeError("Mod " + modId + " hook " + hookId + " returned an invalid event at index " + index);
    }
  }
  return { effects, events };
}

function executeScript({ modId, hookId, source, handler, input, timeoutMs, randomScope = "world" }) {
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > 256 * 1024) {
    throw new RangeError("Mod " + modId + " script is missing or exceeds 256 KiB");
  }
  const safeInput = cloneJson(input, "Mod hook input");
  const seed = hashSeed(modId + ":" + hookId + ":" + String(input.day ?? 0) + ":" + randomScope);
  const invocation = [
    "(function () {",
    '"use strict";',
    "const __input = JSON.parse(" + JSON.stringify(safeInput.serialized) + ");",
    "const __freeze = (value) => { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const key of Object.keys(value)) __freeze(value[key]); return Object.freeze(value); };",
    "__freeze(__input);",
    "let __randomState = " + seed + ";",
    "Object.defineProperty(globalThis.Math, 'random', { value: undefined, writable: false, configurable: false });",
    "Object.defineProperty(globalThis, 'Date', { value: undefined, writable: false, configurable: false });",
    "const __safeMath = Object.create(globalThis.Math);",
    "Object.defineProperty(__safeMath, 'random', { value: undefined });",
    "Object.freeze(__safeMath);",
    "const Math = __safeMath;",
    "const Date = undefined, process = undefined, require = undefined, module = undefined, exports = undefined;",
    "const fetch = undefined, console = undefined, setTimeout = undefined, setInterval = undefined, queueMicrotask = undefined, performance = undefined;",
    "const api = Object.freeze({",
    "random() { __randomState ^= __randomState << 13; __randomState ^= __randomState >>> 17; __randomState ^= __randomState << 5; return (__randomState >>> 0) / 4294967296; },",
    "clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); },",
    "round(value, digits = 2) { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; }",
    "});",
    "const __handler = (function () {",
    '"use strict";',
    source,
    "return typeof " + handler + " === 'function' ? " + handler + " : null;",
    "})();",
    "if (!__handler) throw new Error('Declared Mod hook function was not found');",
    "const __result = __handler(__input, api);",
    "if (__result && typeof __result.then === 'function') throw new TypeError('Mod hooks must be synchronous');",
    "return JSON.stringify(__result === undefined ? {} : __result);",
    "})()"
  ].join("\n");

  const context = vm.createContext(Object.create(null), {
    name: "mod:" + modId + ":" + hookId,
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: "afterEvaluate"
  });
  const output = vm.runInContext(invocation, context, { timeout: timeoutMs });
  if (typeof output !== "string") throw new TypeError("Mod hook did not return a JSON result");
  if (Buffer.byteLength(output, "utf8") > MAX_MOD_OUTPUT_BYTES) {
    throw new RangeError("Mod " + modId + " hook " + hookId + " exceeded the output size limit");
  }
  return normalizeHookResult(JSON.parse(output), modId, hookId);
}

function createModExtensionRuntime(modPackages = [], options = {}) {
  if (!Array.isArray(modPackages)) throw new TypeError("Mod extension packages must be an array");
  const timeoutMs = options.timeoutMs ?? DEFAULT_MOD_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_MOD_TIMEOUT_MS) {
    throw new RangeError("Mod hook timeout must be between 1 and " + MAX_MOD_TIMEOUT_MS + " ms");
  }

  const hooks = new Map();
  const packages = modPackages.filter((mod) => mod && mod.enabled !== false)
    .slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const mod of packages) {
    if (!MOD_ID_PATTERN.test(mod.id || "")) throw new TypeError("Mod extension package has an invalid ID");
    const scripts = mod.scripts || {};
    const declarations = mod.hooks || {};
    if (!isRecord(scripts) || !isRecord(declarations)) throw new TypeError("Mod " + mod.id + " has invalid script declarations");
    const entries = Object.entries(declarations).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length > MAX_MOD_HOOKS) throw new RangeError("Mod " + mod.id + " declares too many hooks");
    for (const [hookId, target] of entries) {
      if (!MOD_HOOK_PATTERN.test(hookId)) throw new TypeError("Mod " + mod.id + " declares an invalid hook ID: " + hookId);
      if (typeof target !== "string") throw new TypeError("Mod " + mod.id + " hook target must be text");
      const separator = target.lastIndexOf(":");
      const file = target.slice(0, separator);
      const handler = target.slice(separator + 1);
      if (separator <= 0 || !/^[A-Za-z0-9_-]{1,64}\.js$/.test(file)
        || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(handler) || typeof scripts[file] !== "string") {
        throw new TypeError("Mod " + mod.id + " has an invalid target for hook " + hookId);
      }
      if (!hooks.has(hookId)) hooks.set(hookId, []);
      hooks.get(hookId).push({ modId: mod.id, source: scripts[file], handler });
    }
  }

  function run(hookId, input = {}, options = {}) {
    if (typeof hookId !== "string" || !MOD_HOOK_PATTERN.test(hookId)) {
      throw new TypeError("Mod hook ID must be a stable lowercase identifier");
    }
    if (!isRecord(input)) throw new TypeError("Mod hook input must be an object");
    const randomScope = typeof options.randomScope === "string" ? options.randomScope : "world";
    const modStateById = isRecord(options.modStateById) ? options.modStateById : {};
    const outcomes = [];
    for (const definition of hooks.get(hookId) || []) {
      try {
        const modState = isRecord(modStateById[definition.modId]) ? modStateById[definition.modId] : {};
        const hookInput = { ...input, modState };
        if (isRecord(hookInput.world) && Object.hasOwn(hookInput.world, "modState")) {
          hookInput.world = { ...hookInput.world };
          delete hookInput.world.modState;
        }
        const result = executeScript({ ...definition, hookId, input: hookInput, timeoutMs, randomScope });
        outcomes.push({ modId: definition.modId, hookId, ...result });
      } catch (error) {
        const failure = new Error("Mod " + definition.modId + " hook " + hookId + " failed: " + error.message, { cause: error });
        failure.code = "MOD_HOOK_FAILURE";
        failure.modId = definition.modId;
        failure.hookId = hookId;
        throw failure;
      }
    }
    return outcomes;
  }

  return Object.freeze({
    run,
    hookIds: () => [...hooks.keys()].sort(),
    count: (hookId) => (hooks.get(hookId) || []).length
  });
}

function requireKeys(payload, allowed, label) {
  if (!isRecord(payload) || Object.keys(payload).some((key) => !allowed.includes(key))) {
    throw new TypeError(label + " contains unsupported fields");
  }
}

function getRequired(collection, id, label) {
  const value = collection?.get?.(id);
  if (!value) throw new Error("Mod effect references missing " + label + ": " + String(id));
  return value;
}

function getModState(world, modId) {
  if (!isRecord(world.modState)) throw new Error("World is missing its schema v7 Mod state namespace");
  if (!Object.hasOwn(world.modState, modId)) world.modState[modId] = {};
  if (!isRecord(world.modState[modId])) throw new Error("World contains invalid Mod state for " + modId);
  return world.modState[modId];
}

function validateModState(state) {
  if (!isRecord(state)) throw new Error("Save is missing or contains invalid Mod state");
  for (const [modId, values] of Object.entries(state)) {
    if (!MOD_ID_PATTERN.test(modId) || !isRecord(values)) throw new Error("Save contains invalid Mod state for " + modId);
    const keys = Object.keys(values);
    if (keys.length > MAX_MOD_STATE_KEYS || keys.some((key) => !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(key))) {
      throw new Error("Save contains invalid Mod state keys for " + modId);
    }
    const serialized = JSON.stringify(values);
    if (Buffer.byteLength(serialized, "utf8") > MAX_MOD_STATE_BYTES) {
      throw new Error("Saved Mod state exceeds the per-Mod limit: " + modId);
    }
  }
  return true;
}

function applyModEffect(effect, world, catalog, modId) {
  const payload = effect.payload;
  switch (effect.type) {
    case "mod.state.set": {
      requireKeys(payload, ["key", "value"], effect.type);
      if (typeof payload.key !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(payload.key)) {
        throw new TypeError("Mod state key must be a stable lowercase ID");
      }
      const state = getModState(world, modId);
      if (!Object.hasOwn(state, payload.key) && Object.keys(state).length >= MAX_MOD_STATE_KEYS) {
        throw new RangeError("Mod state cannot exceed " + MAX_MOD_STATE_KEYS + " keys");
      }
      const value = cloneJson(payload.value, "Mod state value");
      const nextState = { ...state, [payload.key]: value.value };
      if (Buffer.byteLength(JSON.stringify(nextState), "utf8") > MAX_MOD_STATE_BYTES) {
        throw new RangeError("Mod state for " + modId + " exceeds " + MAX_MOD_STATE_BYTES + " bytes");
      }
      const before = state[payload.key] ?? null;
      state[payload.key] = value.value;
      return { modId, key: payload.key, before, after: value.value };
    }
    case "mod.state.increment": {
      requireKeys(payload, ["key", "delta"], effect.type);
      if (typeof payload.key !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(payload.key)) {
        throw new TypeError("Mod state key must be a stable lowercase ID");
      }
      const state = getModState(world, modId);
      if (!Object.hasOwn(state, payload.key) && Object.keys(state).length >= MAX_MOD_STATE_KEYS) {
        throw new RangeError("Mod state cannot exceed " + MAX_MOD_STATE_KEYS + " keys");
      }
      const before = state[payload.key] ?? 0;
      if (typeof before !== "number" || !Number.isFinite(before)) {
        throw new TypeError("Mod state increment requires an existing numeric value: " + payload.key);
      }
      const after = requireFinite(before + requireFinite(payload.delta, effect.type + ".delta"), effect.type + ".result");
      const nextState = { ...state, [payload.key]: after };
      if (Buffer.byteLength(JSON.stringify(nextState), "utf8") > MAX_MOD_STATE_BYTES) {
        throw new RangeError("Mod state for " + modId + " exceeds " + MAX_MOD_STATE_BYTES + " bytes");
      }
      state[payload.key] = after;
      return { modId, key: payload.key, before, after };
    }
    case "mod.state.delete": {
      requireKeys(payload, ["key"], effect.type);
      if (typeof payload.key !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(payload.key)) {
        throw new TypeError("Mod state key must be a stable lowercase ID");
      }
      const state = getModState(world, modId);
      const before = state[payload.key] ?? null;
      delete state[payload.key];
      return { modId, key: payload.key, before, deleted: before !== null };
    }
    case "colony.population.delta": {
      requireKeys(payload, ["colonyId", "delta"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      const next = colony.population + requireFinite(payload.delta, effect.type + ".delta");
      if (next < 0) throw new RangeError("Mod effect cannot reduce population below zero: " + colony.id);
      colony.population = next;
      return { colonyId: colony.id, population: next };
    }
    case "colony.stability.delta": {
      requireKeys(payload, ["colonyId", "delta"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      const before = colony.stability;
      colony.stability = Math.min(100, Math.max(0, before + requireFinite(payload.delta, effect.type + ".delta", 100)));
      return { colonyId: colony.id, before, after: colony.stability };
    }
    case "colony.stockpile.delta": {
      requireKeys(payload, ["colonyId", "commodityId", "delta"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      getRequired(catalog.commodities, payload.commodityId, "commodity");
      const before = colony.stockpiles[payload.commodityId] ?? 0;
      const after = before + requireFinite(payload.delta, effect.type + ".delta");
      if (after < 0) throw new RangeError("Mod effect cannot create a negative stockpile: " + colony.id + "." + payload.commodityId);
      colony.stockpiles[payload.commodityId] = after;
      return { colonyId: colony.id, commodityId: payload.commodityId, before, after };
    }
    case "market.price.multiplier": {
      requireKeys(payload, ["marketId", "instrumentId", "multiplier"], effect.type);
      const market = world.markets?.[payload.marketId];
      if (!market) throw new Error("Missing market " + String(payload.marketId));
      const multiplier = requireFinite(payload.multiplier, effect.type + ".multiplier", 100);
      if (multiplier <= 0) throw new RangeError("Market price multiplier must be positive");
      const commodity = catalog.commodities.get(payload.instrumentId);
      const security = catalog.securities.get(payload.instrumentId);
      const basePrice = commodity?.basePrice ?? security?.initialPrice;
      if (!Number.isFinite(basePrice) || !Object.hasOwn(market.prices, payload.instrumentId)) {
        throw new Error("Market effect references an unlisted instrument: " + payload.marketId + "." + payload.instrumentId);
      }
      const before = market.prices[payload.instrumentId];
      const after = Math.min(basePrice * 10, Math.max(basePrice * 0.1, before * multiplier));
      market.prices[payload.instrumentId] = after;
      const priorChange = market.lastChanges[payload.instrumentId];
      if (Number.isFinite(priorChange)) {
        const priorQuote = before / (1 + priorChange / 100);
        if (priorQuote > 0) market.lastChanges[payload.instrumentId] = Math.round(((after - priorQuote) / priorQuote) * 10000) / 100;
      }
      return { marketId: market.id, instrumentId: payload.instrumentId, before, after, change: market.lastChanges[payload.instrumentId] ?? null };
    }
    case "war.weariness.delta": {
      requireKeys(payload, ["warId", "factionId", "delta"], effect.type);
      const war = world.wars?.[payload.warId];
      if (!war || !war.participants.includes(payload.factionId)) {
        throw new Error("War effect references a missing war participant: " + payload.warId + "." + payload.factionId);
      }
      const before = war.warWeariness[payload.factionId];
      const after = before + requireFinite(payload.delta, effect.type + ".delta");
      if (after < 0) throw new RangeError("War weariness cannot be negative: " + payload.warId + "." + payload.factionId);
      war.warWeariness[payload.factionId] = after;
      return { warId: war.id, factionId: payload.factionId, before, after };
    }
    case "fleet.readiness.delta":
    case "fleet.morale.delta": {
      requireKeys(payload, ["fleetId", "delta"], effect.type);
      const fleet = world.fleets?.[payload.fleetId];
      if (!fleet) throw new Error("Missing fleet " + String(payload.fleetId));
      const key = effect.type === "fleet.readiness.delta" ? "readiness" : "morale";
      const before = fleet[key];
      fleet[key] = Math.min(100, Math.max(0, before + requireFinite(payload.delta, effect.type + ".delta", 100)));
      return { fleetId: fleet.id, field: key, before, after: fleet[key] };
    }
    default:
      throw new Error("Unsupported Mod effect type: " + effect.type);
  }
}

function applyModHookResults(outcomes, { world, catalog, day, hookId, subjectKey = "world", emitDomainEvent }) {
  if (!Array.isArray(outcomes)) throw new TypeError("Mod hook outcomes must be an array");
  if (typeof emitDomainEvent !== "function") throw new TypeError("Mod effects require a domain-event emitter");
  let effectCount = 0;
  let eventCount = 0;
  for (const outcome of outcomes) {
    for (const [index, effect] of outcome.effects.entries()) {
      const result = applyModEffect(effect, world, catalog, outcome.modId);
      emitDomainEvent({
        type: "mod.effect-applied",
        scope: "mod",
        subjectId: outcome.modId,
        idempotencyKey: "mod:" + outcome.modId + ":" + day + ":" + hashSeed(hookId + ":" + subjectKey) + ":effect:" + index,
        payload: { modId: outcome.modId, hookId, subjectKey, effectType: effect.type, input: effect.payload, result }
      });
      effectCount += 1;
    }
    for (const [index, event] of outcome.events.entries()) {
      emitDomainEvent({
        type: "mod." + outcome.modId.replace(/_/g, "-") + "." + event.type,
        scope: "mod",
        subjectId: outcome.modId,
        idempotencyKey: "mod:" + outcome.modId + ":" + day + ":" + hashSeed(hookId + ":" + subjectKey) + ":event:" + index,
        payload: { ...(event.payload ?? {}), modId: outcome.modId, eventType: event.type }
      });
      eventCount += 1;
    }
  }
  return { effectCount, eventCount };
}

module.exports = {
  DEFAULT_MOD_HOOK_TIMEOUT_MS: DEFAULT_MOD_TIMEOUT_MS,
  MAX_MOD_EVENTS,
  MAX_MOD_EFFECTS,
  MAX_MOD_HOOK_INPUT_BYTES,
  MAX_MOD_OUTPUT_BYTES,
  MAX_MOD_STATE_BYTES,
  MAX_MOD_STATE_KEYS,
  MAX_MOD_TIMEOUT_MS,
  createModExtensionRuntime,
  applyModHookResults,
  validateModState
};
