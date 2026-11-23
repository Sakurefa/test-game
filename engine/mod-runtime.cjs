"use strict";

const vm = require("node:vm");
const {
  applyPopulationDelta,
  applyPopulationGroupSplit,
  applyPopulationGroupMerge,
  applyPopulationGroupDimensionSet,
  matchPopulationDimensionCategories
} = require("./population.cjs");
const { CALCULATION_AUDIT_LIMIT } = require("./formulas.cjs");

const MOD_HOOK_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MOD_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const MOD_EVENT_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MOD_EVENT_SCOPE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const MOD_EVENT_SUBJECT_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const MAX_MOD_HOOKS = 64;
const MAX_MOD_EFFECTS = 128;
const MAX_MOD_EVENTS = 64;
const MAX_MOD_TRIGGERS = 32;
const MAX_MOD_HOOK_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_MOD_OUTPUT_BYTES = 128 * 1024;
const MAX_MOD_STATE_BYTES = 64 * 1024;
const MAX_MOD_STATE_KEYS = 128;
const STOCKPILE_ALLOCATION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const MAX_STOCKPILE_ALLOCATION_REQUESTS = 2048;
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
  const allowed = ["effects", "events", "triggers", "calculations"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new TypeError("Mod " + modId + " hook " + hookId + " returned an unsupported result field");
  }
  const effects = value.effects ?? [];
  const events = value.events ?? [];
  const triggers = value.triggers ?? [];
  const calculations = value.calculations ?? [];
  if (!Array.isArray(triggers) || triggers.length > MAX_MOD_TRIGGERS) {
    throw new RangeError("Mod " + modId + " hook " + hookId + " exceeded the trigger limit");
  }
  if (!Array.isArray(effects) || effects.length > MAX_MOD_EFFECTS) {
    throw new RangeError("Mod " + modId + " hook " + hookId + " exceeded the effect limit");
  }
  if (!Array.isArray(events) || events.length > MAX_MOD_EVENTS) {
    throw new RangeError("Mod " + modId + " hook " + hookId + " exceeded the event limit");
  }
  if (!Array.isArray(calculations) || calculations.length > 512) {
    throw new RangeError("Mod " + modId + " hook " + hookId + " exceeded the calculation record limit");
  }
  for (const [index, effect] of effects.entries()) {
    if (!isRecord(effect) || Object.keys(effect).some((key) => key !== "type" && key !== "payload")
      || typeof effect.type !== "string" || !MOD_HOOK_PATTERN.test(effect.type) || !isRecord(effect.payload)) {
      throw new TypeError("Mod " + modId + " hook " + hookId + " returned an invalid effect at index " + index);
    }
  }
  for (const [index, event] of events.entries()) {
    if (!isRecord(event) || Object.keys(event).some((key) =>
      !["type", "payload", "scope", "subjectId"].includes(key))
      || typeof event.type !== "string" || event.type.length > 48
      || !MOD_EVENT_PATTERN.test(event.type) || !isRecord(event.payload ?? {})
      || (event.scope !== undefined && (typeof event.scope !== "string" || !MOD_EVENT_SCOPE_PATTERN.test(event.scope)))
      || (event.subjectId !== undefined && event.subjectId !== null
        && (typeof event.subjectId !== "string" || !MOD_EVENT_SUBJECT_PATTERN.test(event.subjectId)))) {
      throw new TypeError("Mod " + modId + " hook " + hookId + " returned an invalid event at index " + index);
    }
  }
  for (const [index, trigger] of triggers.entries()) {
    if (!isRecord(trigger) || Object.keys(trigger).some((key) => !["id", "due", "event"].includes(key))
      || typeof trigger.id !== "string" || !isRecord(trigger.due) || !isRecord(trigger.event)) {
      throw new TypeError("Mod " + modId + " hook " + hookId + " returned an invalid trigger at index " + index);
    }
  }
  for (const [index, calculation] of calculations.entries()) {
    if (!isRecord(calculation) || Object.keys(calculation).some((key) =>
      !["formulaId", "version", "inputs", "steps", "modifiers", "randomDraws", "result"].includes(key))
      || typeof calculation.formulaId !== "string" || !MOD_HOOK_PATTERN.test(calculation.formulaId)
      || !Number.isInteger(calculation.version) || calculation.version < 1
      || !isRecord(calculation.inputs) || !Array.isArray(calculation.steps)
      || !Array.isArray(calculation.modifiers) || !Array.isArray(calculation.randomDraws)
      || !isRecord(calculation.result)) {
      throw new TypeError("Mod " + modId + " hook " + hookId + " returned an invalid calculation record at index " + index);
    }
    cloneJson(calculation, "Mod calculation record");
  }
  return { effects, events, triggers, calculations };
}

function executeScript({
  modId, hookId, source, handler, input, timeoutMs, randomScope = "world", resultMode = "hook", randomSource = null
}) {
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
    "const __baseSeed = " + seed + ";",
    "const __randomStates = Object.create(null);",
    "const __hostRandom = globalThis.__hostRandom; delete globalThis.__hostRandom;",
    "const __hostMatchPopulationTag = globalThis.__hostMatchPopulationTag; delete globalThis.__hostMatchPopulationTag;",
    "const __steps = [], __modifiers = [], __randomDraws = [];",
    "function __seedFor(scope) { let hash = 2166136261; const value = __baseSeed + ':' + scope; for (const character of value) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0 || 1; }",
    "Object.defineProperty(globalThis.Math, 'random', { value: undefined, writable: false, configurable: false });",
    "Object.defineProperty(globalThis, 'Date', { value: undefined, writable: false, configurable: false });",
    "const __safeMath = Object.create(globalThis.Math);",
    "Object.defineProperty(__safeMath, 'random', { value: undefined });",
    "Object.freeze(__safeMath);",
    "const Math = __safeMath;",
    "const Date = undefined, process = undefined, require = undefined, module = undefined, exports = undefined;",
    "const fetch = undefined, console = undefined, setTimeout = undefined, setInterval = undefined, queueMicrotask = undefined, performance = undefined;",
    "const api = Object.freeze({",
    "random(scope = 'default') { const key = String(scope); let value; if (typeof __hostRandom === 'function') { value = __hostRandom(key); } else { let state = Object.hasOwn(__randomStates, key) ? __randomStates[key] : __seedFor(key); state ^= state << 13; state ^= state >>> 17; state ^= state << 5; state >>>= 0; __randomStates[key] = state; value = state / 4294967296; } __randomDraws.push({ streamId: key, method: 'next', args: [], value }); return value; },",
    "clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); },",
    "round(value, digits = 2) { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; },",
    "recordStep(id, value, detail = '') { __steps.push({ id: String(id), value, detail: String(detail) }); },",
    "recordModifier(id, value, reason = '') { __modifiers.push({ id: String(id), value, reason: String(reason) }); },",
    "matchPopulationTag(colonyId, groupId, tagId) { if (typeof __hostMatchPopulationTag !== 'function') throw new Error('Population Tag matching is unavailable in this execution'); return __hostMatchPopulationTag(colonyId, groupId, tagId); },",
    "evaluatePopulationNeedRule(colonyId, groupId, ruleId) { if (typeof __hostEvaluatePopulationNeedRule !== 'function') throw new Error('Population Need evaluation is unavailable in this execution'); return __hostEvaluatePopulationNeedRule(colonyId, groupId, ruleId); }",
    "});",
    "const __handler = (function () {",
    '"use strict";',
    source,
    "return typeof " + handler + " === 'function' ? " + handler + " : null;",
    "})();",
    "if (!__handler) throw new Error('Declared Mod function was not found');",
    "const __result = __handler(__input, api);",
    "if (__result && typeof __result.then === 'function') throw new TypeError('Mod scripts must be synchronous');",
    "return JSON.stringify({ value: __result === undefined ? {} : __result, steps: __steps, modifiers: __modifiers, randomDraws: __randomDraws });",
    "})()"
  ].join("\n");

  const sandbox = Object.create(null);
  if (typeof randomSource === "function") {
    sandbox.__hostRandom = (scope) => randomSource(scope);
  } else if (randomSource && typeof randomSource.next === "function") {
    sandbox.__hostRandom = () => randomSource.next();
  }
  if (resultMode === "hook") {
    const resolvePopulationMatch = (colonyId, groupId, tagId) => {
      if ([colonyId, groupId, tagId].some((value) => typeof value !== "string")) {
        throw new TypeError("Population matching requires colony, group and Tag IDs");
      }
      const world = safeInput.value.world;
      const colony = world?.colonies?.[colonyId];
      const group = colony?.populationGroups?.[groupId];
      if (!group) {
        throw new Error("Population matching cannot find population group "
          + colonyId + "/" + groupId);
      }
      const tags = safeInput.value.catalog?.populationTags;
      const tag = Array.isArray(tags) ? tags.find((item) => item.id === tagId) : null;
      if (!tag) throw new Error("Population matching cannot find population Tag " + tagId);
      return matchPopulationDimensionCategories(group, tag.dimensionId, tag.categoryIds);
    };
    sandbox.__hostMatchPopulationTag = (colonyId, groupId, tagId) => {
      return resolvePopulationMatch(colonyId, groupId, tagId);
    };
    sandbox.__hostEvaluatePopulationNeedRule = (colonyId, groupId, ruleId) => {
      if ([colonyId, groupId, ruleId].some((value) => typeof value !== "string")) {
        throw new TypeError("Population Need evaluation requires colony, group and rule IDs");
      }
      const rules = safeInput.value.catalog?.populationNeedRules;
      const rule = Array.isArray(rules) ? rules.find((item) => item.id === ruleId) : null;
      if (!rule) throw new Error("Population Need evaluation cannot find rule " + ruleId);
      const match = resolvePopulationMatch(colonyId, groupId, rule.populationTagId);
      const dailyNeedPerThousand = requireFinite(
        rule.dailyNeedPerThousand,
        "Population Need rule dailyNeedPerThousand"
      );
      if (dailyNeedPerThousand <= 0) {
        throw new RangeError("Population Need rule dailyNeedPerThousand must be positive");
      }
      const requested = match.dimensionPresent
        ? requireFinite(match.matchedPopulation / 1000 * dailyNeedPerThousand,
          "Population Need requested quantity")
        : null;
      return {
        ruleId: rule.id,
        populationTagId: rule.populationTagId,
        groupId,
        commodityId: rule.commodityId,
        dimensionId: match.dimensionId,
        categoryIds: match.categoryIds,
        dimensionPresent: match.dimensionPresent,
        matchedProportion: match.matchedProportion,
        matchedPopulation: match.matchedPopulation,
        dailyNeedPerThousand,
        requested
      };
    };
  }
  const context = vm.createContext(sandbox, {
    name: "mod:" + modId + ":" + hookId,
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: "afterEvaluate"
  });
  const output = vm.runInContext(invocation, context, { timeout: timeoutMs });
  if (typeof output !== "string") throw new TypeError("Mod script did not return a JSON result");
  if (Buffer.byteLength(output, "utf8") > MAX_MOD_OUTPUT_BYTES) {
    throw new RangeError("Mod " + modId + " script " + hookId + " exceeded the output size limit");
  }
  const envelope = JSON.parse(output);
  if (!isRecord(envelope) || !Array.isArray(envelope.steps)
    || !Array.isArray(envelope.modifiers) || !Array.isArray(envelope.randomDraws)) {
    throw new TypeError("Mod script returned an invalid execution envelope");
  }
  if (resultMode === "formula") {
    if (!isRecord(envelope.value)) throw new TypeError("Mod formula must return an object result");
    return {
      result: cloneJson(envelope.value, "Mod formula result").value,
      steps: cloneJson(envelope.steps, "Mod formula steps").value,
      modifiers: cloneJson(envelope.modifiers, "Mod formula modifiers").value,
      randomDraws: cloneJson(envelope.randomDraws, "Mod formula random draws").value
    };
  }
  return normalizeHookResult(envelope.value, modId, hookId);
}

function createModExtensionRuntime(modPackages = [], options = {}) {
  if (!Array.isArray(modPackages)) throw new TypeError("Mod extension packages must be an array");
  const timeoutMs = options.timeoutMs ?? DEFAULT_MOD_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_MOD_TIMEOUT_MS) {
    throw new RangeError("Mod hook timeout must be between 1 and " + MAX_MOD_TIMEOUT_MS + " ms");
  }

  const hooks = new Map();
  const formulas = new Map();
  const packages = modPackages.filter((mod) => mod && mod.enabled !== false)
    .slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const mod of packages) {
    if (!MOD_ID_PATTERN.test(mod.id || "")) throw new TypeError("Mod extension package has an invalid ID");
    const scripts = mod.scripts || {};
    const declarations = mod.hooks || {};
    const formulaDeclarations = mod.formulas || {};
    if (!isRecord(scripts) || !isRecord(declarations) || !isRecord(formulaDeclarations)) {
      throw new TypeError("Mod " + mod.id + " has invalid script declarations");
    }
    for (const [formulaId, target] of Object.entries(formulaDeclarations).sort(([a], [b]) => a.localeCompare(b))) {
      if (!MOD_HOOK_PATTERN.test(formulaId) || !isRecord(target)
        || typeof target.file !== "string" || typeof target.handler !== "string"
        || !Number.isInteger(target.version) || target.version < 1
        || typeof scripts[target.file] !== "string"
        || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(target.handler)) {
        throw new TypeError("Mod " + mod.id + " has an invalid formula declaration: " + formulaId);
      }
      if (formulas.has(formulaId)) throw new Error("Duplicate Mod formula ID: " + formulaId);
      formulas.set(formulaId, {
        id: formulaId, modId: mod.id, version: target.version,
        source: scripts[target.file], handler: target.handler
      });
    }
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
      const randomSource = typeof options.randomSource === "function"
        ? (scope) => options.randomSource(definition.modId, hookId, randomScope, scope)
        : null;
      try {
        const modState = isRecord(modStateById[definition.modId]) ? modStateById[definition.modId] : {};
        const hookInput = { ...input, modState };
        if (isRecord(hookInput.world) && Object.hasOwn(hookInput.world, "modState")) {
          hookInput.world = { ...hookInput.world };
          delete hookInput.world.modState;
        }
        const result = executeScript({ ...definition, hookId, input: hookInput, timeoutMs, randomScope, randomSource });
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

  function runFormula(formulaId, inputs = {}, context = {}) {
    const definition = formulas.get(formulaId);
    if (!definition) throw new Error("Unknown Mod formula: " + formulaId);
    if (!isRecord(inputs)) throw new TypeError("Mod formula inputs must be an object");
    try {
      return executeScript({
        ...definition,
        hookId: "formula." + formulaId,
        input: {
          inputs,
          day: Number.isInteger(context.day) ? context.day : null,
          randomScope: typeof context.randomScope === "string" ? context.randomScope : "world"
        },
        timeoutMs,
        randomScope: typeof context.randomScope === "string" ? context.randomScope : "world",
        resultMode: "formula",
        randomSource: context.randomSource
      });
    } catch (error) {
      const failure = new Error("Mod " + definition.modId + " formula " + formulaId + " failed: " + error.message, { cause: error });
      failure.code = "MOD_FORMULA_FAILURE";
      failure.modId = definition.modId;
      failure.formulaId = formulaId;
      throw failure;
    }
  }

  function formulaDefinitions() {
    return [...formulas.values()].map((definition) => ({
      id: definition.id,
      version: definition.version,
      calculate: ({ inputs, day, randomStreamId, random }) => ({
        __formulaTrace: true,
        ...runFormula(definition.id, inputs, { day, randomScope: randomStreamId, randomSource: random }),
        randomDraws: []
      })
    }));
  }

  return Object.freeze({
    run,
    runFormula,
    formulaDefinitions,
    formulaIds: () => [...formulas.keys()].sort(),
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

function validatePopulationDimensionReferences(catalog, dimensions, label) {
  if (!isRecord(dimensions)) throw new TypeError(label + " dimensions must be an object");
  for (const [dimensionId, distribution] of Object.entries(dimensions)) {
    const collection = dimensionId === "profession" ? catalog.professions
      : dimensionId === "wealth_tier" ? catalog.wealthTiers : null;
    if (!collection) continue;
    for (const categoryId of Object.keys(distribution)) {
      getRequired(collection, categoryId, label + " " + dimensionId);
    }
  }
}

function getModState(world, modId) {
  if (!isRecord(world.modState)) throw new Error("World is missing its schema v8 Mod state namespace");
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
      const before = Object.hasOwn(state, payload.key) ? state[payload.key] : 0;
      if (typeof before !== "number" || !Number.isFinite(before)) {
        throw new TypeError("Mod state increment cannot add to a non-numeric existing value: " + payload.key);
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
      const existed = Object.hasOwn(state, payload.key);
      const before = existed ? state[payload.key] : null;
      delete state[payload.key];
      return { modId, key: payload.key, before, deleted: existed };
    }
    case "colony.population.delta": {
      requireKeys(payload, ["colonyId", "delta"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      const result = applyPopulationDelta(colony, requireFinite(payload.delta, effect.type + ".delta"));
      return { colonyId: colony.id, ...result };
    }
    case "colony.population.group.split": {
      requireKeys(payload, [
        "colonyId", "sourceGroupId", "newGroupId", "population", "sourceDimensions", "newDimensions"
      ], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      if (payload.sourceDimensions !== undefined && payload.newDimensions !== undefined) {
        validatePopulationDimensionReferences(catalog, payload.sourceDimensions, effect.type);
        validatePopulationDimensionReferences(catalog, payload.newDimensions, effect.type);
      }
      return applyPopulationGroupSplit(colony, {
        sourceGroupId: payload.sourceGroupId,
        newGroupId: payload.newGroupId,
        population: requireFinite(payload.population, effect.type + ".population"),
        ...(payload.sourceDimensions === undefined ? {} : { sourceDimensions: payload.sourceDimensions }),
        ...(payload.newDimensions === undefined ? {} : { newDimensions: payload.newDimensions })
      });
    }
    case "colony.population.group.merge": {
      requireKeys(payload, ["colonyId", "sourceGroupId", "targetGroupId"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      return applyPopulationGroupMerge(colony, {
        sourceGroupId: payload.sourceGroupId,
        targetGroupId: payload.targetGroupId
      });
    }
    case "colony.population.group.dimension.set": {
      requireKeys(payload, ["colonyId", "groupId", "dimensionId", "distribution"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      validatePopulationDimensionReferences(catalog, {
        [payload.dimensionId]: payload.distribution
      }, effect.type);
      return applyPopulationGroupDimensionSet(colony, {
        groupId: payload.groupId,
        dimensionId: payload.dimensionId,
        distribution: payload.distribution
      });
    }
    case "colony.stability.delta": {
      requireKeys(payload, ["colonyId", "delta"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      const before = colony.stability;
      colony.stability = Math.min(100, Math.max(0, before + requireFinite(payload.delta, effect.type + ".delta", 100)));
      return { colonyId: colony.id, before, after: colony.stability };
    }
    case "colony.stockpile.allocate": {
      requireKeys(payload, ["colonyId", "requests", "allocations"], effect.type);
      if (typeof payload.colonyId !== "string" || !STOCKPILE_ALLOCATION_ID_PATTERN.test(payload.colonyId)) {
        throw new TypeError("Stockpile allocation requires a valid colony ID");
      }
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      if (!isRecord(colony.stockpiles)) throw new TypeError("Colony stockpiles are missing or invalid");
      if (!Array.isArray(payload.requests) || !Array.isArray(payload.allocations)
        || payload.requests.length > MAX_STOCKPILE_ALLOCATION_REQUESTS
        || payload.allocations.length !== payload.requests.length) {
        throw new TypeError("Stockpile allocation requires matching bounded request and allocation arrays");
      }
      const requests = [];
      const requestsById = new Map();
      for (const [index, request] of payload.requests.entries()) {
        requireKeys(request, ["id", "requesterId", "commodityId", "requested"], effect.type + ".requests[" + index + "]");
        if (typeof request.id !== "string" || !STOCKPILE_ALLOCATION_ID_PATTERN.test(request.id)
          || typeof request.requesterId !== "string" || !STOCKPILE_ALLOCATION_ID_PATTERN.test(request.requesterId)) {
          throw new TypeError("Stockpile allocation request IDs must be stable identifiers");
        }
        if (requestsById.has(request.id)) throw new Error("Stockpile allocation contains a duplicate request ID: " + request.id);
        getRequired(catalog.commodities, request.commodityId, "commodity");
        const requested = requireFinite(request.requested, effect.type + ".requested");
        if (requested < 0) throw new RangeError("Stockpile allocation requested quantity cannot be negative");
        const normalized = { id: request.id, requesterId: request.requesterId, commodityId: request.commodityId, requested };
        requests.push(normalized);
        requestsById.set(request.id, normalized);
      }
      const allocationsByRequest = new Map();
      for (const [index, allocation] of payload.allocations.entries()) {
        requireKeys(allocation, ["requestId", "allocated"], effect.type + ".allocations[" + index + "]");
        if (typeof allocation.requestId !== "string" || !requestsById.has(allocation.requestId)) {
          throw new Error("Stockpile allocation references an unknown request: " + String(allocation.requestId));
        }
        if (allocationsByRequest.has(allocation.requestId)) {
          throw new Error("Stockpile allocation contains a duplicate result for request: " + allocation.requestId);
        }
        const allocated = requireFinite(allocation.allocated, effect.type + ".allocated");
        if (allocated < 0) throw new RangeError("Stockpile allocation cannot be negative");
        const request = requestsById.get(allocation.requestId);
        if (allocated > request.requested) throw new RangeError("Stockpile allocation exceeds requested quantity: " + allocation.requestId);
        allocationsByRequest.set(allocation.requestId, allocated);
      }
      for (const request of requests) {
        if (!allocationsByRequest.has(request.id)) throw new Error("Stockpile allocation is missing a result for request: " + request.id);
      }
      const allocatedByCommodity = new Map();
      for (const request of requests) {
        const allocated = allocationsByRequest.get(request.id);
        allocatedByCommodity.set(request.commodityId, (allocatedByCommodity.get(request.commodityId) || 0) + allocated);
      }
      const stockpileChanges = [];
      for (const [commodityId, allocated] of [...allocatedByCommodity.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const before = requireFinite(colony.stockpiles[commodityId] ?? 0, effect.type + ".available");
        if (before < 0) throw new RangeError("Stockpile allocation found a negative inventory: " + colony.id + "." + commodityId);
        const after = before - allocated;
        const tolerance = Math.max(1, Math.abs(before)) * 1e-12;
        if (after < -tolerance) throw new RangeError("Stockpile allocation exceeds available inventory: " + colony.id + "." + commodityId);
        stockpileChanges.push({ commodityId, before, allocated, after: Math.max(0, after) });
      }
      // Validate the complete plan before changing any stockpile.
      for (const change of stockpileChanges) colony.stockpiles[change.commodityId] = change.after;
      const allocationResults = requests.map((request) => {
        const allocated = allocationsByRequest.get(request.id);
        const unmet = Math.max(0, request.requested - allocated);
        return { ...request, allocated, unmet, satisfaction: request.requested > 0 ? allocated / request.requested : 1 };
      });
      return { colonyId: colony.id, requests: allocationResults, stockpileChanges };
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
    case "colony.production.report.set": {
      requireKeys(payload, ["colonyId", "day", "production", "industries"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      if (!Number.isInteger(payload.day) || payload.day < 0 || !isRecord(payload.production)
        || !Array.isArray(payload.industries)) throw new TypeError("Invalid colony production report");
      const production = cloneJson(payload.production, "Colony production report").value;
      for (const [commodityId, quantity] of Object.entries(production)) {
        getRequired(catalog.commodities, commodityId, "commodity");
        requireFinite(quantity, "Colony production report quantity", 1e12);
        if (quantity < 0) throw new RangeError("Colony production report quantities cannot be negative");
      }
      const industries = cloneJson(payload.industries, "Colony production report industries").value;
      colony.lastProduction = production;
      colony.lastProductionReport = { day: payload.day, industries };
      return { colonyId: colony.id, day: payload.day, production, industryCount: industries.length };
    }
    case "colony.needs.report.set": {
      requireKeys(payload, ["colonyId", "day", "population", "needs", "shortageCount"], effect.type);
      const colony = world.colonies?.[payload.colonyId];
      if (!colony) throw new Error("Missing colony " + String(payload.colonyId));
      if (!Number.isInteger(payload.day) || payload.day < 0
        || !Number.isFinite(payload.population) || payload.population < 0
        || !Array.isArray(payload.needs) || !Number.isInteger(payload.shortageCount) || payload.shortageCount < 0) {
        throw new TypeError("Invalid colony needs report");
      }
      const needs = cloneJson(payload.needs, "Colony needs report").value;
      for (const item of needs) {
        if (!isRecord(item) || typeof item.commodityId !== "string") throw new TypeError("Invalid colony need report entry");
        getRequired(catalog.commodities, item.commodityId, "commodity");
        for (const key of ["available", "requested", "consumed", "unmet", "satisfaction"]) {
          requireFinite(item[key], "Colony needs report " + key, 1e12);
        }
      }
      colony.lastNeedsReport = {
        day: payload.day,
        population: payload.population,
        needs,
        shortageCount: payload.shortageCount
      };
      return { colonyId: colony.id, day: payload.day, needCount: needs.length, shortageCount: payload.shortageCount };
    }
    case "market.price.set": {
      requireKeys(payload, ["marketId", "instrumentId", "price"], effect.type);
      const market = world.markets?.[payload.marketId];
      if (!market) throw new Error("Missing market " + String(payload.marketId));
      const commodity = catalog.commodities.get(payload.instrumentId);
      const security = catalog.securities.get(payload.instrumentId);
      if ((!commodity && !security) || !Object.hasOwn(market.prices, payload.instrumentId)) {
        throw new Error("Market effect references an unlisted instrument: " + payload.marketId + "." + payload.instrumentId);
      }
      const price = requireFinite(payload.price, effect.type + ".price", 1e15);
      if (price <= 0) throw new RangeError("Market price must be positive");
      const before = market.prices[payload.instrumentId];
      const priorChange = market.lastChanges[payload.instrumentId];
      market.prices[payload.instrumentId] = price;
      if (Number.isFinite(priorChange)) {
        const priorQuote = before / (1 + priorChange / 100);
        if (priorQuote > 0) market.lastChanges[payload.instrumentId] = Math.round(((price - priorQuote) / priorQuote) * 10000) / 100;
      } else {
        market.lastChanges[payload.instrumentId] = Math.round(((price - before) / before) * 10000) / 100;
      }
      return { marketId: market.id, instrumentId: payload.instrumentId, before, after: price, change: market.lastChanges[payload.instrumentId] };
    }
    case "market.price.multiplier": {
      requireKeys(payload, ["marketId", "instrumentId", "multiplier"], effect.type);
      const market = world.markets?.[payload.marketId];
      if (!market) throw new Error("Missing market " + String(payload.marketId));
      const multiplier = requireFinite(payload.multiplier, effect.type + ".multiplier", 1e12);
      if (multiplier <= 0) throw new RangeError("Market price multiplier must be positive");
      const commodity = catalog.commodities.get(payload.instrumentId);
      const security = catalog.securities.get(payload.instrumentId);
      if ((!commodity && !security) || !Object.hasOwn(market.prices, payload.instrumentId)) {
        throw new Error("Market effect references an unlisted instrument: " + payload.marketId + "." + payload.instrumentId);
      }
      const before = market.prices[payload.instrumentId];
      const after = requireFinite(before * multiplier, "Market price result", 1e15);
      if (after <= 0) throw new RangeError("Market price result must be positive");
      market.prices[payload.instrumentId] = after;
      const priorChange = market.lastChanges[payload.instrumentId];
      if (Number.isFinite(priorChange)) {
        const priorQuote = before / (1 + priorChange / 100);
        if (priorQuote > 0) market.lastChanges[payload.instrumentId] = Math.round(((after - priorQuote) / priorQuote) * 10000) / 100;
      } else {
        market.lastChanges[payload.instrumentId] = Math.round(((after - before) / before) * 10000) / 100;
      }
      return { marketId: market.id, instrumentId: payload.instrumentId, before, after, change: market.lastChanges[payload.instrumentId] };
    }
    case "war.days-active.delta": {
      requireKeys(payload, ["warId", "delta"], effect.type);
      const war = world.wars?.[payload.warId];
      if (!war) throw new Error("Missing war " + String(payload.warId));
      if (!Number.isSafeInteger(payload.delta) || payload.delta < 0) {
        throw new RangeError("War days-active delta must be a non-negative integer");
      }
      const before = war.daysActive;
      war.daysActive += payload.delta;
      return { warId: war.id, before, after: war.daysActive };
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

function applyModHookResults(outcomes, { world, catalog, day, hookId, subjectKey = "world", emitDomainEvent, scheduleTrigger }) {
  if (!Array.isArray(outcomes)) throw new TypeError("Mod hook outcomes must be an array");
  if (typeof emitDomainEvent !== "function") throw new TypeError("Mod effects require a domain-event emitter");
  const allocationPlansByColony = new Set();
  for (const outcome of outcomes) {
    for (const effect of outcome.effects || []) {
      if (effect?.type !== "colony.stockpile.allocate" || typeof effect.payload?.colonyId !== "string") continue;
      if (allocationPlansByColony.has(effect.payload.colonyId)) {
        throw new Error("A hook may submit only one stockpile allocation plan per colony: " + effect.payload.colonyId);
      }
      allocationPlansByColony.add(effect.payload.colonyId);
    }
  }
  let effectCount = 0;
  let eventCount = 0;
  let triggerCount = 0;
  let calculationCount = 0;
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
        scope: event.scope || "mod",
        subjectId: event.subjectId ?? outcome.modId,
        idempotencyKey: "mod:" + outcome.modId + ":" + day + ":" + hashSeed(hookId + ":" + subjectKey) + ":event:" + index,
        payload: { ...(event.payload ?? {}), modId: outcome.modId, eventType: event.type }
      });
      eventCount += 1;
    }
    for (const calculation of outcome.calculations || []) {
      if (!isRecord(world.audit)) world.audit = { calculations: [] };
      if (!Array.isArray(world.audit.calculations)) world.audit.calculations = [];
      world.audit.calculations.push({
        day,
        modId: outcome.modId,
        formulaId: calculation.formulaId,
        version: calculation.version,
        inputs: calculation.inputs,
        modifiers: calculation.modifiers,
        steps: calculation.steps,
        randomDraws: calculation.randomDraws,
        result: calculation.result
      });
      calculationCount += 1;
    }
    if (isRecord(world.audit) && Array.isArray(world.audit.calculations)
      && world.audit.calculations.length > CALCULATION_AUDIT_LIMIT) {
      world.audit.calculations.splice(0, world.audit.calculations.length - CALCULATION_AUDIT_LIMIT);
    }
    for (const trigger of outcome.triggers || []) {
      if (typeof scheduleTrigger !== "function") {
        throw new TypeError("Mod hook triggers require an Engine Trigger Queue");
      }
      scheduleTrigger({ modId: outcome.modId, trigger });
      triggerCount += 1;
    }
  }
  return { effectCount, eventCount, triggerCount, calculationCount };
}

module.exports = {
  DEFAULT_MOD_HOOK_TIMEOUT_MS: DEFAULT_MOD_TIMEOUT_MS,
  MAX_MOD_EVENTS,
  MAX_MOD_TRIGGERS,
  MAX_MOD_EFFECTS,
  MAX_MOD_HOOK_INPUT_BYTES,
  MAX_MOD_OUTPUT_BYTES,
  MAX_MOD_STATE_BYTES,
  MAX_MOD_STATE_KEYS,
  MAX_MOD_TIMEOUT_MS,
  createModExtensionRuntime,
  applyModEffect,
  applyModHookResults,
  validateModState
};
