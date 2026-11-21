"use strict";

const { normalizeDomainEventDescriptor } = require("./domain-events.cjs");

const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX_RESOLUTION_EFFECTS = 16;
const MAX_RESOLUTION_DOMAIN_EVENTS = 16;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneResult(value, label) {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new TypeError(label + " must return an object");
  const encoded = JSON.stringify(value, (key, item) => {
    if (typeof item === "number" && !Number.isFinite(item)) {
      throw new TypeError(label + " numbers must be finite");
    }
    if (typeof item === "function" || typeof item === "bigint" || typeof item === "undefined") {
      throw new TypeError(label + " must return JSON-safe values");
    }
    return item;
  });
  if (typeof encoded !== "string") throw new TypeError(label + " did not return JSON data");
  return JSON.parse(encoded);
}

function assertSync(value, label) {
  if (value && typeof value.then === "function") {
    if (typeof value.catch === "function") value.catch(() => {});
    throw new TypeError(label + " must be synchronous");
  }
  return value;
}

function cloneResolutionPlan(value, label) {
  if (!isRecord(value) || Object.keys(value).some((key) =>
    key !== "result" && key !== "effects" && key !== "domainEvents")
    || !Object.hasOwn(value, "result") || !Array.isArray(value.effects)
    || (value.domainEvents !== undefined && !Array.isArray(value.domainEvents))) {
    throw new TypeError(label + " must return a { result, effects, domainEvents? } plan");
  }
  if (value.effects.length > MAX_RESOLUTION_EFFECTS) {
    throw new RangeError(label + " cannot return more than " + MAX_RESOLUTION_EFFECTS + " effects");
  }
  const domainEvents = value.domainEvents || [];
  if (domainEvents.length > MAX_RESOLUTION_DOMAIN_EVENTS) {
    throw new RangeError(label + " cannot return more than " + MAX_RESOLUTION_DOMAIN_EVENTS + " Domain Events");
  }
  const result = cloneResult(value.result, label + " result");
  const effects = value.effects.map((effect, index) => {
    if (!isRecord(effect) || Object.keys(effect).some((key) => key !== "type" && key !== "payload")
      || typeof effect.type !== "string" || !EVENT_TYPE_PATTERN.test(effect.type)
      || !isRecord(effect.payload)) {
      throw new TypeError(label + " returned an invalid Effect descriptor at index " + index);
    }
    return { type: effect.type, payload: cloneResult(effect.payload, label + " Effect " + index + " payload") };
  });
  const plannedDomainEvents = domainEvents.map((event, index) => {
    if (!isRecord(event) || Object.keys(event).some((key) =>
      key !== "type" && key !== "scope" && key !== "subjectId" && key !== "payload")) {
      throw new TypeError(label + " returned an invalid Domain Event descriptor at index " + index);
    }
    try {
      const normalized = normalizeDomainEventDescriptor(event);
      return { type: normalized.type, scope: normalized.scope, subjectId: normalized.subjectId, payload: normalized.payload };
    } catch (error) {
      throw new TypeError(label + " returned an invalid Domain Event descriptor at index " + index + ": " + error.message, { cause: error });
    }
  });
  return { result, effects, domainEvents: plannedDomainEvents };
}

function createResolutionRegistry(definitions = []) {
  if (!Array.isArray(definitions)) throw new TypeError("Resolution definitions must be an array");
  const handlers = new Map();

  function register(definition) {
    if (!isRecord(definition) || typeof definition.id !== "string"
      || !EVENT_TYPE_PATTERN.test(definition.id)) {
      throw new TypeError("Every resolution requires a stable lowercase ID");
    }
    if (handlers.has(definition.id)) throw new Error("Duplicate resolution: " + definition.id);
    if (typeof definition.resolve !== "function") {
      throw new TypeError("Resolution " + definition.id + " requires a resolve function");
    }
    if (definition.validate !== undefined && typeof definition.validate !== "function") {
      throw new TypeError("Resolution " + definition.id + ".validate must be a function");
    }
    handlers.set(definition.id, Object.freeze({ ...definition }));
    return definition.id;
  }

  for (const definition of definitions) register(definition);

  function getDefinition(event) {
    if (!isRecord(event) || typeof event.type !== "string" || !EVENT_TYPE_PATTERN.test(event.type)) {
      throw new TypeError("Cannot resolve an invalid System Event");
    }
    const definition = handlers.get(event.type);
    if (!definition) throw new Error("No Engine resolution is registered for System Event: " + event.type);
    return definition;
  }

  function validate(event, context = {}) {
    const definition = getDefinition(event);
    if (!definition.validate) return true;
    const result = assertSync(definition.validate({ event, ...context }), "Resolution validation " + definition.id);
    if (result === false) throw new Error("Resolution validation rejected System Event: " + definition.id);
    if (typeof result === "string" && result.length > 0) throw new Error(result);
    if (result !== undefined && result !== true && result !== null) {
      throw new TypeError("Resolution validation " + definition.id + " must return true, false, a message or undefined");
    }
    return true;
  }

  function resolve(event, context = {}) {
    const definition = getDefinition(event);
    validate(event, context);
    const result = assertSync(
      definition.resolve({ event, ...context }),
      "Resolution " + definition.id
    );
    return cloneResolutionPlan(result, "Resolution " + definition.id);
  }

  return Object.freeze({
    register,
    has: (id) => handlers.has(id),
    validate,
    resolve,
    types: () => [...handlers.keys()].sort()
  });
}

module.exports = { MAX_RESOLUTION_EFFECTS, MAX_RESOLUTION_DOMAIN_EVENTS, createResolutionRegistry };
