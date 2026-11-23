"use strict";

const CALCULATION_AUDIT_LIMIT = 200;
const DEFAULT_FORMULAS = Object.freeze([]);

function cloneRecord(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createTracingRandom(random, streamId, draws) {
  if (!random || typeof random.next !== "function") {
    throw new TypeError("A formula random stream must provide next()");
  }
  return Object.freeze(Object.fromEntries(["next", "nextUint32", "int", "range", "chance", "pick"].map((method) => [
    method,
    (...args) => {
      if (typeof random[method] !== "function") {
        throw new TypeError("Random stream does not support " + method + "()");
      }
      const value = random[method](...args);
      draws.push({ streamId, method, args: cloneRecord(args), value: cloneRecord(value) });
      return value;
    }
  ])));
}

function createCalculationService({ definitions = DEFAULT_FORMULAS, historyLimit = CALCULATION_AUDIT_LIMIT } = {}) {
  if (!Array.isArray(definitions)) throw new TypeError("Formula definitions must be an array");
  if (!Number.isInteger(historyLimit) || historyLimit < 1) {
    throw new RangeError("Calculation audit history limit must be positive");
  }

  const registry = new Map();
  for (const definition of definitions) {
    if (!definition || typeof definition.id !== "string"
      || !/^[a-z][a-z0-9._-]{1,95}$/.test(definition.id)
      || !Number.isInteger(definition.version) || definition.version < 1
      || typeof definition.calculate !== "function") {
      throw new TypeError("Formula definitions require stable ID, version and calculate");
    }
    if (registry.has(definition.id)) throw new Error("Duplicate formula ID: " + definition.id);
    registry.set(definition.id, Object.freeze({ ...definition }));
  }

  const records = [];

  function evaluate(id, inputs, context = {}) {
    const definition = registry.get(id);
    if (!definition) throw new Error("Unknown calculation formula: " + id);
    if (!isRecord(inputs)) throw new TypeError("Formula inputs must be an object");

    const steps = [];
    const modifiers = [];
    const randomDraws = [];
    const random = context.random
      ? createTracingRandom(context.random, context.randomStreamId || "unscoped", randomDraws)
      : null;

    const raw = definition.calculate({
      inputs: cloneRecord(inputs),
      random,
      day: Number.isInteger(context.day) ? context.day : null,
      randomStreamId: context.randomStreamId || "unscoped",
      recordStep: (stepId, value, detail = "") => {
        steps.push({ id: String(stepId), value: cloneRecord(value), detail: String(detail) });
      },
      recordModifier: (modifierId, value, reason = "") => {
        modifiers.push({ id: String(modifierId), value: cloneRecord(value), reason: String(reason) });
      }
    });
    if (raw && typeof raw.then === "function") {
      throw new TypeError("Formula " + id + " must be synchronous");
    }

    let result = raw;
    if (isRecord(raw) && raw.__formulaTrace === true) {
      if (!isRecord(raw.result) || !Array.isArray(raw.steps)
        || !Array.isArray(raw.modifiers) || !Array.isArray(raw.randomDraws)) {
        throw new TypeError("Formula " + id + " returned an invalid calculation trace");
      }
      result = cloneRecord(raw.result);
      steps.push(...cloneRecord(raw.steps));
      modifiers.push(...cloneRecord(raw.modifiers));
      randomDraws.push(...cloneRecord(raw.randomDraws));
    } else {
      result = cloneRecord(raw);
    }
    if (!isRecord(result)) throw new TypeError("Formula " + id + " must return an object result");

    const record = Object.freeze({
      day: Number.isInteger(context.day) ? context.day : null,
      formulaId: id,
      version: definition.version,
      inputs: cloneRecord(inputs),
      modifiers,
      steps,
      randomDraws,
      result: cloneRecord(result)
    });
    records.push(record);
    if (records.length > historyLimit) records.splice(0, records.length - historyLimit);
    return { result, record };
  }

  return Object.freeze({
    evaluate,
    getDefinition: (id) => {
      const definition = registry.get(id);
      return definition ? { id: definition.id, version: definition.version } : null;
    },
    listDefinitions: () => [...registry.values()].map(({ id, version }) => ({ id, version })),
    getRecords: () => records.map(cloneRecord),
    clear: () => { records.length = 0; },
    get size() { return records.length; }
  });
}

module.exports = { CALCULATION_AUDIT_LIMIT, DEFAULT_FORMULAS, createCalculationService };
