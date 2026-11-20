const CALCULATION_AUDIT_LIMIT = 200;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function cloneRecord(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function createTracingRandom(random, streamId, randomDraws) {
  if (!random || typeof random.next !== "function") {
    throw new TypeError("A formula random stream must provide next()");
  }
  const methods = ["next", "nextUint32", "int", "range", "chance", "pick"];
  return Object.freeze(Object.fromEntries(methods.map((method) => [method, (...args) => {
    if (typeof random[method] !== "function") throw new TypeError("Random stream does not support " + method + "()");
    const value = random[method](...args);
    randomDraws.push({ streamId, method, args: cloneRecord(args), value: cloneRecord(value) });
    return value;
  }])));
}

const DEFAULT_FORMULAS = Object.freeze([
  Object.freeze({
    id: "economy.commodity-price",
    version: 1,
    calculate: ({ inputs, random, recordStep, recordModifier }) => {
      const scarcity = clamp((inputs.targetStock - inputs.stock) / inputs.targetStock, -1, 1.5);
      recordStep("scarcity", scarcity);
      const fundamentals = inputs.basePrice * clamp(1 + scarcity * inputs.priceElasticity, 0.25, 3.5);
      recordStep("fundamental-price", fundamentals);
      const noise = (random.next() - 0.5) * inputs.volatility;
      recordModifier("market-volatility", noise, "Seeded daily market variation");
      const target = Math.max(0.01, fundamentals * (1 + noise));
      recordStep("target-price", target);
      const price = round(inputs.previousPrice + (target - inputs.previousPrice) * 0.18);
      const change = round((price - inputs.previousPrice) / inputs.previousPrice * 100, 2);
      return { price, change };
    }
  }),
  Object.freeze({
    id: "economy.security-price",
    version: 1,
    calculate: ({ inputs, random, recordStep, recordModifier }) => {
      const operationalDrift = clamp(inputs.outputValue * 0.00001, 0, 0.003);
      recordStep("operational-drift", operationalDrift);
      const noise = (random.next() - 0.5) * inputs.volatility;
      recordModifier("market-volatility", noise, "Seeded daily market variation");
      const price = round(Math.max(0.01, inputs.previousPrice * (1 + noise + operationalDrift)));
      const change = round((price - inputs.previousPrice) / inputs.previousPrice * 100, 2);
      return { price, change };
    }
  })
]);

function createCalculationService({ definitions = DEFAULT_FORMULAS, historyLimit = CALCULATION_AUDIT_LIMIT } = {}) {
  if (!Array.isArray(definitions) || definitions.length === 0) throw new TypeError("At least one formula definition is required");
  if (!Number.isInteger(historyLimit) || historyLimit < 1) throw new RangeError("Calculation audit history limit must be positive");
  const registry = new Map();
  for (const definition of definitions) {
    if (!definition || typeof definition.id !== "string"
      || !/^[a-z][a-z0-9._-]{1,95}$/.test(definition.id)
      || !Number.isInteger(definition.version) || definition.version < 1
      || typeof definition.calculate !== "function") {
      throw new TypeError("Formula definitions require a stable ID, positive version and calculate function");
    }
    if (registry.has(definition.id)) throw new Error("Duplicate formula ID: " + definition.id);
    registry.set(definition.id, Object.freeze({ ...definition }));
  }

  const records = [];
  function evaluate(id, inputs, context = {}) {
    const definition = registry.get(id);
    if (!definition) throw new Error("Unknown calculation formula: " + id);
    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) throw new TypeError("Formula inputs must be an object");
    const steps = [];
    const modifiers = [];
    const randomDraws = [];
    const random = context.random
      ? createTracingRandom(context.random, context.randomStreamId || "unscoped", randomDraws)
      : null;
    const result = definition.calculate({
      inputs: cloneRecord(inputs),
      random,
      recordStep: (stepId, value, detail = "") => {
        steps.push({ id: String(stepId), value: cloneRecord(value), detail: String(detail) });
      },
      recordModifier: (modifierId, value, reason = "") => {
        modifiers.push({ id: String(modifierId), value: cloneRecord(value), reason: String(reason) });
      }
    });
    if (result && typeof result.then === "function") throw new TypeError("Formula " + id + " must be synchronous");
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
    getRecords: () => records.map((record) => cloneRecord(record)),
    clear: () => { records.length = 0; },
    get size() { return records.length; }
  });
}

module.exports = { CALCULATION_AUDIT_LIMIT, DEFAULT_FORMULAS, createCalculationService };
