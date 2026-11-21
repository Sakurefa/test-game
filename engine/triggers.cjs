"use strict";

const { parseDate } = require("./clock.cjs");
const { createSystemEvent } = require("./system-events.cjs");
const { settleSystemEvent } = require("./settlement.cjs");

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const MOD_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const SUBJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,127}$/;
const MAX_PENDING_TRIGGERS = 4096;
const MAX_TRIGGER_RECEIPTS = 256;
const MAX_TRIGGER_PAYLOAD_BYTES = 16 * 1024;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, allowed) {
  return isRecord(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function cloneJson(value, label = "Trigger payload") {
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
  if (Buffer.byteLength(encoded, "utf8") > MAX_TRIGGER_PAYLOAD_BYTES) {
    throw new RangeError(label + " exceeds " + MAX_TRIGGER_PAYLOAD_BYTES + " bytes");
  }
  return JSON.parse(encoded);
}

function dayDistance(from, to) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000);
}

function createTriggerQueue() {
  return { pending: [], receipts: [] };
}

function triggerSignature(trigger) {
  return JSON.stringify({
    id: trigger.id,
    ownerId: trigger.ownerId,
    due: trigger.due,
    dueDay: trigger.due.kind === "domain-event" ? null : trigger.dueDay,
    event: trigger.event
  });
}

function normalizeDue(due, clock) {
  if (!isRecord(due) || typeof due.kind !== "string") {
    throw new TypeError("Trigger due must be a date, elapsed-time or Domain Event descriptor");
  }
  if (due.kind === "date") {
    if (!exactKeys(due, ["kind", "date"]) || typeof due.date !== "string") {
      throw new TypeError("Date Trigger due accepts only kind and date");
    }
    const days = dayDistance(clock.date, due.date);
    if (days < 1) throw new RangeError("Date Trigger must be scheduled after the current campaign date");
    return { due: { kind: "date", date: due.date }, dueDay: clock.day + days };
  }
  if (due.kind === "elapsed") {
    if (!exactKeys(due, ["kind", "days"]) || !Number.isInteger(due.days) || due.days < 1 || due.days > 36500) {
      throw new RangeError("Elapsed Trigger days must be an integer between 1 and 36500");
    }
    return { due: { kind: "elapsed", days: due.days }, dueDay: clock.day + due.days };
  }
  if (due.kind === "domain-event") {
    if (!exactKeys(due, ["kind", "type", "scope", "subjectId"])
      || !EVENT_TYPE_PATTERN.test(due.type || "")
      || (Object.hasOwn(due, "scope") && (typeof due.scope !== "string" || !SCOPE_PATTERN.test(due.scope)))
      || (Object.hasOwn(due, "subjectId") && due.subjectId !== null
        && (typeof due.subjectId !== "string" || !SUBJECT_ID_PATTERN.test(due.subjectId)))) {
      throw new TypeError("Domain Event Trigger due requires a type and optional valid scope/subjectId filters");
    }
    const normalized = { kind: "domain-event", type: due.type };
    if (Object.hasOwn(due, "scope")) normalized.scope = due.scope;
    if (Object.hasOwn(due, "subjectId")) normalized.subjectId = due.subjectId;
    return { due: normalized, dueDay: null };
  }
  throw new Error("Unsupported Trigger due kind: " + due.kind);
}

function normalizeDomainEventSnapshot(event) {
  if (!isRecord(event) || !exactKeys(event, [
    "id", "sequence", "day", "date", "type", "scope", "subjectId", "payload", "idempotencyKey"
  ]) || !Number.isSafeInteger(event.sequence) || event.sequence < 1
    || event.id !== "domain-" + event.sequence
    || !Number.isInteger(event.day) || event.day < 0
    || typeof event.date !== "string" || !EVENT_TYPE_PATTERN.test(event.type || "")
    || typeof event.scope !== "string" || !SCOPE_PATTERN.test(event.scope)
    || (event.subjectId !== null && (typeof event.subjectId !== "string" || !SUBJECT_ID_PATTERN.test(event.subjectId)))
    || !isRecord(event.payload)
    || (event.idempotencyKey !== undefined
      && (typeof event.idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(event.idempotencyKey)))) {
    throw new TypeError("Trigger source must be a valid Domain Event record");
  }
  parseDate(event.date);
  const snapshot = {
    id: event.id,
    sequence: event.sequence,
    day: event.day,
    date: event.date,
    type: event.type,
    scope: event.scope,
    subjectId: event.subjectId,
    payload: cloneJson(event.payload, "Trigger source Domain Event payload")
  };
  if (event.idempotencyKey !== undefined) snapshot.idempotencyKey = event.idempotencyKey;
  return cloneJson(snapshot, "Trigger source Domain Event");
}

function matchesDomainEvent(due, event) {
  return event.type === due.type
    && (!Object.hasOwn(due, "scope") || event.scope === due.scope)
    && (!Object.hasOwn(due, "subjectId") || event.subjectId === due.subjectId);
}

function normalizeTrigger(world, definition) {
  if (!isRecord(world) || !isRecord(world.clock) || !Number.isInteger(world.clock.day) || world.clock.day < 0) {
    throw new TypeError("Trigger scheduling requires an authoritative campaign clock");
  }
  parseDate(world.clock.date);
  if (!isRecord(definition) || !exactKeys(definition, ["id", "ownerId", "due", "event"])
    || !ID_PATTERN.test(definition.id || "") || !MOD_ID_PATTERN.test(definition.ownerId || "")) {
    throw new TypeError("Trigger requires only stable id, ownerId, due and event fields");
  }
  if (!definition.id.startsWith(definition.ownerId + ".")) {
    throw new Error("Trigger ID must be namespaced by its owning Mod: " + definition.id);
  }
  if (!isRecord(definition.event) || !exactKeys(definition.event, ["type", "payload"])
    || !EVENT_TYPE_PATTERN.test(definition.event.type || "") || !isRecord(definition.event.payload)) {
    throw new TypeError("Trigger event requires a stable type ID and object payload");
  }
  const { due, dueDay } = normalizeDue(definition.due, world.clock);
  const event = { type: definition.event.type, payload: cloneJson(definition.event.payload) };
  const trigger = {
    id: definition.id,
    ownerId: definition.ownerId,
    createdDay: world.clock.day,
    createdDate: world.clock.date,
    due,
    dueDay,
    event
  };
  if (due.kind === "domain-event") trigger.sourceEvent = null;
  trigger.signature = triggerSignature(trigger);
  return trigger;
}

function scheduleTrigger(world, definition, { resolutions, catalog } = {}) {
  if (!world || !world.triggerQueue || !Array.isArray(world.triggerQueue.pending)
    || !Array.isArray(world.triggerQueue.receipts)) {
    throw new Error("World has no valid Trigger Queue");
  }
  if (!resolutions || typeof resolutions.has !== "function" || typeof resolutions.validate !== "function") {
    throw new TypeError("Trigger scheduling requires an Engine resolution registry");
  }
  const existing = typeof definition?.id === "string"
    ? world.triggerQueue.pending.find((item) => item.id === definition.id)
      || world.triggerQueue.receipts.find((item) => item.id === definition.id)
    : null;
  const basisWorld = existing
    ? { clock: {
        day: Number.isInteger(existing.createdDay) ? existing.createdDay : existing.scheduledDay,
        date: existing.createdDate
      } }
    : world;
  const trigger = normalizeTrigger(basisWorld, definition);
  if (!resolutions.has(trigger.event.type)) {
    throw new Error("Trigger references an unregistered System Event type: " + trigger.event.type);
  }
  if (Array.isArray(catalog?.modIds) && !catalog.modIds.includes(trigger.ownerId)) {
    throw new Error("Trigger owner Mod is not part of the loaded catalog: " + trigger.ownerId);
  }
  if (existing) {
    if (existing.signature !== trigger.signature) {
      throw new Error("Trigger ID was already used for a different definition: " + trigger.id);
    }
    return { id: trigger.id, duplicate: true, dueDay: existing.dueDay };
  }

  const systemEvent = createSystemEvent(trigger, world.clock);
  resolutions.validate(systemEvent, { world, catalog, trigger });
  if (world.triggerQueue.pending.length >= MAX_PENDING_TRIGGERS) {
    throw new RangeError("Trigger Queue cannot exceed " + MAX_PENDING_TRIGGERS + " pending entries");
  }
  world.triggerQueue.pending.push(trigger);
  return { id: trigger.id, duplicate: false, dueDay: trigger.dueDay };
}

function validateTriggerQueue(world, { modIds, isEventRegistered } = {}) {
  const queue = world?.triggerQueue;
  const currentDay = world?.clock?.day;
  if (!isRecord(queue) || !exactKeys(queue, ["pending", "receipts"])
    || !Array.isArray(queue.pending) || !Array.isArray(queue.receipts)
    || queue.pending.length > MAX_PENDING_TRIGGERS || queue.receipts.length > MAX_TRIGGER_RECEIPTS) {
    throw new Error("Save has an invalid Trigger Queue");
  }
  if (!Number.isInteger(currentDay) || currentDay < 0) throw new Error("Trigger Queue requires a valid campaign day");
  const seen = new Set();

  for (const trigger of queue.pending) {
    if (!isRecord(trigger) || !exactKeys(trigger, [
      "id", "ownerId", "createdDay", "createdDate", "due", "dueDay", "event", "signature", "sourceEvent"
    ]) || !ID_PATTERN.test(trigger.id || "") || !MOD_ID_PATTERN.test(trigger.ownerId || "")
      || !trigger.id.startsWith(trigger.ownerId + ".")
      || !Number.isInteger(trigger.createdDay) || trigger.createdDay < 0 || trigger.createdDay > currentDay
      || typeof trigger.createdDate !== "string" || !isRecord(trigger.due)
      || !isRecord(trigger.event) || !EVENT_TYPE_PATTERN.test(trigger.event.type || "")
      || !isRecord(trigger.event.payload) || typeof trigger.signature !== "string") {
      throw new Error("Save contains an invalid pending Trigger");
    }
    parseDate(trigger.createdDate);
    const normalizedDue = normalizeDue(trigger.due, {
      day: trigger.createdDay, date: trigger.createdDate
    });
    if (normalizedDue.due.kind === "domain-event") {
      if (!Object.hasOwn(trigger, "sourceEvent")) {
        throw new Error("Domain Event Trigger is missing its source-event state: " + trigger.id);
      }
      if (trigger.sourceEvent === null) {
        if (trigger.dueDay !== null) throw new Error("Unmatched Domain Event Trigger has a due day: " + trigger.id);
      } else {
        const sourceEvent = normalizeDomainEventSnapshot(trigger.sourceEvent);
        if (!matchesDomainEvent(normalizedDue.due, sourceEvent)
          || sourceEvent.day < trigger.createdDay || sourceEvent.day > currentDay
          || trigger.dueDay !== sourceEvent.day + 1) {
          throw new Error("Save contains an invalid matched Domain Event Trigger: " + trigger.id);
        }
      }
    } else {
      if (Object.hasOwn(trigger, "sourceEvent")
        || !Number.isSafeInteger(trigger.dueDay) || trigger.dueDay <= trigger.createdDay) {
        throw new Error("Save contains an invalid scheduled Trigger due day: " + trigger.id);
      }
      if (normalizedDue.due.kind === "date") {
        if (dayDistance(trigger.createdDate, normalizedDue.due.date) !== trigger.dueDay - trigger.createdDay) {
          throw new Error("Save contains an invalid date Trigger due descriptor: " + trigger.id);
        }
      } else if (normalizedDue.due.kind === "elapsed") {
        if (trigger.dueDay !== trigger.createdDay + normalizedDue.due.days) {
          throw new Error("Save contains an invalid elapsed Trigger due descriptor: " + trigger.id);
        }
      }
    }
    const normalizedPayload = cloneJson(trigger.event.payload);
    const normalizedTrigger = {
      ...trigger,
      due: normalizedDue.due,
      event: { ...trigger.event, payload: normalizedPayload }
    };
    if (trigger.signature !== triggerSignature(normalizedTrigger)) {
      throw new Error("Save contains a modified Trigger signature: " + trigger.id);
    }
    if (seen.has(trigger.id)) throw new Error("Save contains duplicate Trigger IDs: " + trigger.id);
    seen.add(trigger.id);
    if (Array.isArray(modIds) && !modIds.includes(trigger.ownerId)) {
      throw new Error("Save contains a Trigger owned by an unavailable Mod: " + trigger.ownerId);
    }
    if (typeof isEventRegistered === "function" && !isEventRegistered(trigger.event.type)) {
      throw new Error("Save contains an unregistered Trigger event type: " + trigger.event.type);
    }
  }

  for (const receipt of queue.receipts) {
    if (!isRecord(receipt) || !exactKeys(receipt, [
      "id", "ownerId", "signature", "dueDay", "scheduledDay", "createdDate",
      "processedDay", "eventType", "due", "event", "sourceEvent"
    ]) || !ID_PATTERN.test(receipt.id || "") || !MOD_ID_PATTERN.test(receipt.ownerId || "")
      || !receipt.id.startsWith(receipt.ownerId + ".") || typeof receipt.signature !== "string"
      || !Number.isSafeInteger(receipt.dueDay) || !Number.isInteger(receipt.scheduledDay)
      || !Number.isInteger(receipt.processedDay) || receipt.scheduledDay < 0
      || receipt.dueDay <= receipt.scheduledDay || receipt.processedDay < receipt.dueDay
      || receipt.processedDay > currentDay || !EVENT_TYPE_PATTERN.test(receipt.eventType || "")
      || !isRecord(receipt.due) || !isRecord(receipt.event)
      || !EVENT_TYPE_PATTERN.test(receipt.event.type || "") || !isRecord(receipt.event.payload)
      || receipt.eventType !== receipt.event.type || typeof receipt.createdDate !== "string") {
      throw new Error("Save contains an invalid Trigger receipt");
    }
    parseDate(receipt.createdDate);
    const normalizedReceiptDue = normalizeDue(receipt.due, {
      day: receipt.scheduledDay, date: receipt.createdDate
    });
    let expectedDueDay = normalizedReceiptDue.dueDay;
    if (normalizedReceiptDue.due.kind === "domain-event") {
      if (!Object.hasOwn(receipt, "sourceEvent")) {
        throw new Error("Domain Event Trigger receipt is missing its source event: " + receipt.id);
      }
      const sourceEvent = normalizeDomainEventSnapshot(receipt.sourceEvent);
      if (!matchesDomainEvent(normalizedReceiptDue.due, sourceEvent)
        || sourceEvent.day < receipt.scheduledDay || sourceEvent.day > receipt.processedDay) {
        throw new Error("Trigger receipt has an invalid source Domain Event: " + receipt.id);
      }
      expectedDueDay = sourceEvent.day + 1;
    } else if (Object.hasOwn(receipt, "sourceEvent")) {
      throw new Error("Time-based Trigger receipt contains a source Domain Event: " + receipt.id);
    }
    const normalizedReceiptEvent = {
      type: receipt.event.type,
      payload: cloneJson(receipt.event.payload)
    };
    const receiptSignature = triggerSignature({
      id: receipt.id, ownerId: receipt.ownerId,
      due: normalizedReceiptDue.due, dueDay: normalizedReceiptDue.dueDay,
      event: normalizedReceiptEvent
    });
    if (expectedDueDay !== receipt.dueDay || receipt.signature !== receiptSignature) {
      throw new Error("Save contains a modified Trigger receipt: " + receipt.id);
    }
    if (seen.has(receipt.id)) throw new Error("Save contains duplicate Trigger IDs: " + receipt.id);
    seen.add(receipt.id);
    if (Array.isArray(modIds) && !modIds.includes(receipt.ownerId)) {
      throw new Error("Save contains a Trigger receipt owned by an unavailable Mod: " + receipt.ownerId);
    }
    if (typeof isEventRegistered === "function" && !isEventRegistered(receipt.eventType)) {
      throw new Error("Save contains a receipt for an unregistered Trigger event type: " + receipt.eventType);
    }
  }
  return true;
}

function activateDomainEventTriggers(world, event) {
  if (!world?.triggerQueue || !Array.isArray(world.triggerQueue.pending)) {
    throw new Error("World has no valid Trigger Queue");
  }
  const matches = world.triggerQueue.pending.filter((trigger) =>
    trigger.due?.kind === "domain-event"
    && trigger.sourceEvent === null
    && matchesDomainEvent(trigger.due, event)
  );
  if (matches.length === 0) return 0;

  const sourceEvent = normalizeDomainEventSnapshot(event);
  let activated = 0;
  for (const trigger of matches) {
    if (sourceEvent.day < trigger.createdDay) continue;
    trigger.sourceEvent = structuredClone(sourceEvent);
    trigger.dueDay = sourceEvent.day + 1;
    activated += 1;
  }
  return activated;
}

function processDueTriggers(world, { day, date, catalog, resolutions, calculations, randomStreams, applyEffect, emitDomainEvent } = {}) {
  if (!world || !world.triggerQueue || !Array.isArray(world.triggerQueue.pending)
    || !Array.isArray(world.triggerQueue.receipts)) throw new Error("World has no valid Trigger Queue");
  if (!Number.isInteger(day) || day < 0 || typeof emitDomainEvent !== "function"
    || typeof applyEffect !== "function" || !resolutions || typeof resolutions.resolve !== "function") {
    throw new TypeError("Trigger processing requires a campaign boundary, resolution registry, Effect executor and Domain Event emitter");
  }
  parseDate(date);
  validateTriggerQueue(world, {
    modIds: catalog?.modIds,
    isEventRegistered: typeof resolutions.has === "function" ? (id) => resolutions.has(id) : undefined
  });

  const due = world.triggerQueue.pending
    .filter((trigger) => Number.isSafeInteger(trigger.dueDay) && trigger.dueDay <= day)
    .slice()
    .sort((a, b) => a.dueDay - b.dueDay || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const processed = [];

  for (const trigger of due) {
    const systemEvent = createSystemEvent(trigger, { day, date });
    const settlement = settleSystemEvent(systemEvent, {
      world, catalog, day, trigger, resolutions, calculations, randomStreams, applyEffect
    });
    const emittedDomainEvents = settlement.domainEvents.map((descriptor) => emitDomainEvent(descriptor));
    const emittedDomainEventRefs = emittedDomainEvents.map((event) => ({
      id: event.id,
      sequence: event.sequence,
      type: event.type
    }));
    emitDomainEvent({
      type: "trigger.resolved",
      scope: "trigger",
      subjectId: trigger.id,
      idempotencyKey: "trigger:" + trigger.id + ":resolved",
      payload: {
        ownerId: trigger.ownerId,
        systemEventId: systemEvent.id,
        eventType: systemEvent.type,
        resolution: settlement.result,
        effects: settlement.effects,
        ...(emittedDomainEventRefs.length > 0 ? { domainEvents: emittedDomainEventRefs } : {}),
        ...(systemEvent.sourceEvent ? { sourceEvent: systemEvent.sourceEvent } : {})
      }
    });

    const index = world.triggerQueue.pending.findIndex((item) => item.id === trigger.id);
    if (index < 0) throw new Error("Due Trigger disappeared while being processed: " + trigger.id);
    world.triggerQueue.pending.splice(index, 1);
    const receipt = {
      id: trigger.id,
      ownerId: trigger.ownerId,
      signature: trigger.signature,
      dueDay: trigger.dueDay,
      scheduledDay: trigger.createdDay,
      createdDate: trigger.createdDate,
      processedDay: day,
      eventType: trigger.event.type,
      due: structuredClone(trigger.due),
      event: structuredClone(trigger.event)
    };
    if (trigger.sourceEvent) receipt.sourceEvent = structuredClone(trigger.sourceEvent);
    world.triggerQueue.receipts.push(receipt);
    if (world.triggerQueue.receipts.length > MAX_TRIGGER_RECEIPTS) {
      world.triggerQueue.receipts.splice(0, world.triggerQueue.receipts.length - MAX_TRIGGER_RECEIPTS);
    }
    processed.push({
      triggerId: trigger.id,
      ownerId: trigger.ownerId,
      eventType: trigger.event.type,
      resolution: settlement.result,
      effects: settlement.effects,
      domainEvents: emittedDomainEventRefs
    });
  }
  return processed;
}

module.exports = {
  MAX_PENDING_TRIGGERS,
  MAX_TRIGGER_RECEIPTS,
  createTriggerQueue,
  scheduleTrigger,
  activateDomainEventTriggers,
  processDueTriggers,
  validateTriggerQueue
};
