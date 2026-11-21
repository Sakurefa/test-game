"use strict";

const { parseDate } = require("./clock.cjs");

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX_EVENT_PAYLOAD_BYTES = 16 * 1024;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value, label = "System event payload") {
  function normalize(item) {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new TypeError(label + " numbers must be finite");
      return item;
    }
    if (Array.isArray(item)) return item.map(normalize);
    if (!isRecord(item)) throw new TypeError(label + " must contain JSON-safe plain values");
    const output = {};
    for (const key of Object.keys(item).sort()) output[key] = normalize(item[key]);
    return output;
  }
  const normalized = normalize(value);
  const encoded = JSON.stringify(normalized);
  if (Buffer.byteLength(encoded, "utf8") > MAX_EVENT_PAYLOAD_BYTES) {
    throw new RangeError(label + " exceeds " + MAX_EVENT_PAYLOAD_BYTES + " bytes");
  }
  return JSON.parse(encoded);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createSystemEvent(trigger, clock) {
  if (!isRecord(trigger) || !ID_PATTERN.test(trigger.id || "") || !ID_PATTERN.test(trigger.ownerId || "")) {
    throw new TypeError("A System Event requires stable trigger and source IDs");
  }
  if (!isRecord(clock) || !Number.isInteger(clock.day) || clock.day < 0) {
    throw new TypeError("A System Event requires an authoritative campaign day");
  }
  parseDate(clock.date);
  if (!isRecord(trigger.event) || !EVENT_TYPE_PATTERN.test(trigger.event.type || "")
    || !isRecord(trigger.event.payload)) {
    throw new TypeError("A System Event requires a registered event type and object payload");
  }
  const systemEvent = {
    id: "system-event:" + trigger.id,
    type: trigger.event.type,
    triggerId: trigger.id,
    sourceId: trigger.ownerId,
    scheduledDay: trigger.createdDay,
    day: clock.day,
    date: clock.date,
    payload: cloneJson(trigger.event.payload)
  };
  if (trigger.sourceEvent) {
    systemEvent.sourceEvent = cloneJson(trigger.sourceEvent, "System Event source Domain Event");
  }
  return deepFreeze(systemEvent);
}

module.exports = { createSystemEvent };
