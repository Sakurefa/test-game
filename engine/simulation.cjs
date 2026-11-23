const { NamedRandomStreams, hashSeed } = require("./random.cjs");
const { createCalculationService, CALCULATION_AUDIT_LIMIT } = require("./formulas.cjs");
const { parseDate, createClock, advanceClock, advanceClockTime } = require("./clock.cjs");
const { createSystemRegistry } = require("./system-registry.cjs");
const {
  createDomainEventEmitter, normalizeDomainEventDescriptor, validateDomainEventState
} = require("./domain-events.cjs");
const { validateCommandReceiptState } = require("./commands.cjs");
const { createFinancialLedger, createLegacyFinancialLedger, validateWorldFinancialState } = require("./ledger.cjs");
const { createModExtensionRuntime, applyModHookResults, validateModState, applyModEffect } = require("./mod-runtime.cjs");
const { createPopulationGroups, getPopulationTotal, validatePopulationGroups } = require("./population.cjs");
const { createResolutionRegistry, MAX_RESOLUTION_EFFECTS } = require("./resolutions.cjs");
const {
  createTriggerQueue, scheduleTrigger: scheduleTriggerInstance,
  activateDomainEventTriggers, processDueTriggers, validateTriggerQueue
} = require("./triggers.cjs");


function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const FORMULA_EFFECT_FIELD_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const FORMULA_EFFECT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX_FORMULA_EFFECTS = MAX_RESOLUTION_EFFECTS;

function validateSystemEventSource(event, catalog) {
  if (!catalog?.modIds?.includes(event.sourceId)) {
    throw new Error("System Event source Mod is not part of the loaded catalog: " + event.sourceId);
  }
}

function normalizeModEventEmission(event, catalog) {
  validateSystemEventSource(event, catalog);
  const payload = event.payload;
  if (!isRecord(payload) || Object.keys(payload).some((key) => key !== "type" && key !== "payload")
    || typeof payload.type !== "string" || !FORMULA_EFFECT_TYPE_PATTERN.test(payload.type)
    || (payload.payload !== undefined && payload.payload !== null && !isRecord(payload.payload))) {
    throw new TypeError("event.emit requires a Mod event type and optional object payload");
  }
  const type = "mod." + event.sourceId.replace(/_/g, "-") + "." + payload.type;
  const normalized = normalizeDomainEventDescriptor({
    type,
    scope: "mod",
    subjectId: event.sourceId,
    payload: {
      ...(payload.payload || {}),
      modId: event.sourceId,
      eventType: payload.type
    }
  });
  return {
    type: normalized.type,
    scope: normalized.scope,
    subjectId: normalized.subjectId,
    payload: normalized.payload
  };
}

function validateFormulaEffectRequest({ event, catalog }) {
  validateSystemEventSource(event, catalog);
  const payload = event.payload;
  if (!isRecord(payload) || Object.keys(payload).some((key) => !["formulaId", "inputs", "effects"].includes(key))
    || typeof payload.formulaId !== "string" || !catalog?.formulaDefinitions?.has(payload.formulaId)
    || !isRecord(payload.inputs) || !Array.isArray(payload.effects)
    || payload.effects.length < 1 || payload.effects.length > MAX_FORMULA_EFFECTS) {
    throw new TypeError("formula.effect requires a registered formula, input object and 1–" + MAX_FORMULA_EFFECTS + " Effect templates");
  }

  for (const [index, template] of payload.effects.entries()) {
    if (!isRecord(template) || Object.keys(template).some((key) => !["type", "payload", "resultFields"].includes(key))
      || typeof template.type !== "string" || !FORMULA_EFFECT_TYPE_PATTERN.test(template.type)
      || !isRecord(template.payload) || !isRecord(template.resultFields)
      || Object.keys(template.resultFields).length < 1
      || Object.keys(template.resultFields).length > MAX_FORMULA_EFFECTS) {
      throw new TypeError("formula.effect has an invalid Effect template at index " + index);
    }
    for (const [targetField, resultField] of Object.entries(template.resultFields)) {
      if (!FORMULA_EFFECT_FIELD_PATTERN.test(targetField) || !FORMULA_EFFECT_FIELD_PATTERN.test(resultField)
        || Object.hasOwn(template.payload, targetField)) {
        throw new TypeError("formula.effect has an invalid or conflicting result field binding at index " + index);
      }
    }
  }
  return true;
}

function triggerRandomStreamId(triggerId) {
  return "t" + triggerId[0] + Array.from(triggerId.slice(1), (character) =>
    character.charCodeAt(0).toString(16).padStart(2, "0")
  ).join("");
}

const triggerResolutions = createResolutionRegistry([{
  id: "effect.apply",
  validate({ event, world, catalog }) {
    validateSystemEventSource(event, catalog);
    if (!isRecord(event.payload) || Object.keys(event.payload).length !== 1
      || !isRecord(event.payload.effect)
      || Object.keys(event.payload.effect).some((key) => key !== "type" && key !== "payload")
      || typeof event.payload.effect.type !== "string" || !isRecord(event.payload.effect.payload)) {
      throw new TypeError("effect.apply requires one registered Effect descriptor");
    }
    const draft = structuredClone(world);
    applyModEffect(event.payload.effect, draft, catalog, event.sourceId);
    return true;
  },
  resolve({ event }) {
    return {
      result: { effectType: event.payload.effect.type },
      effects: [event.payload.effect]
    };
  }
}, {
  id: "formula.effect",
  validate: validateFormulaEffectRequest,
  resolve({ event, calculations, randomStreams, day }) {
    if (!calculations || typeof calculations.evaluate !== "function"
      || !randomStreams || typeof randomStreams.get !== "function") {
      throw new TypeError("formula.effect requires the day's calculation and random-stream services");
    }
    const streamId = triggerRandomStreamId(event.triggerId);
    const calculated = calculations.evaluate(event.payload.formulaId, event.payload.inputs, {
      day,
      random: randomStreams.get(streamId),
      randomStreamId: streamId
    });
    if (!isRecord(calculated.result)) throw new TypeError("formula.effect requires an object calculation result");

    const effects = event.payload.effects.map((template, index) => {
      const payload = { ...template.payload };
      for (const [targetField, resultField] of Object.entries(template.resultFields)) {
        if (!Object.hasOwn(calculated.result, resultField)) {
          throw new Error("formula.effect result has no field '" + resultField + "' for Effect template " + index);
        }
        payload[targetField] = calculated.result[resultField];
      }
      return { type: template.type, payload };
    });

    return {
      result: {
        formulaId: event.payload.formulaId,
        formulaVersion: calculated.record.version,
        output: calculated.result
      },
      effects
    };
  }
}, {
  id: "event.emit",
  validate({ event, catalog }) {
    normalizeModEventEmission(event, catalog);
    return true;
  },
  resolve({ event, catalog }) {
    const domainEvent = normalizeModEventEmission(event, catalog);
    return {
      result: { domainEventType: domainEvent.type },
      effects: [],
      domainEvents: [domainEvent]
    };
  }
}]);

const modRuntimeCache = new WeakMap();

function getModRuntime(catalog) {
  if (!modRuntimeCache.has(catalog)) {
    modRuntimeCache.set(catalog, createModExtensionRuntime(catalog.extensions || []));
  }
  return modRuntimeCache.get(catalog);
}

function runModHook(modRuntime, hookId, input, {
  world, catalog, day, subjectKey = "world", emitDomainEvent, randomStreams
}) {
  const randomSource = randomStreams && typeof randomStreams.get === "function"
    ? (modId, declaredHookId, randomScope, scope) =>
      randomStreams.get(["mod", modId, declaredHookId, randomScope, scope].join(".")).next()
    : null;
  const outcomes = modRuntime.run(hookId, input, {
    randomScope: subjectKey,
    modStateById: world.modState || {},
    randomSource
  });
  return applyModHookResults(outcomes, {
    world, catalog, day, hookId, subjectKey, emitDomainEvent,
    scheduleTrigger: ({ modId, trigger }) => scheduleTriggerInstance(
      world, { ...trigger, ownerId: modId },
      { resolutions: triggerResolutions, catalog }
    )
  });
}

const GAME_STATE_SCHEMA_VERSION = 9;
const MAX_ADVANCE_DAYS = 30;
const MAX_CAMPAIGN_CATCH_UP_DAYS = 3650;
const LOG_LIMIT = 100;

function localized(catalog, key, values = {}) {
  const template = catalog.localizations?.[catalog.defaultLocale]?.[key] || "[" + (key || "missing-localization-key") + "]";
  return template.replace(/\{([a-z][a-z0-9_]*)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
}

function validateCampaignClock(clock, startDate, label) {
  const start = parseDate(startDate);
  const current = parseDate(clock.date);
  const elapsedDays = (current.getTime() - start.getTime()) / 86400000;
  if (elapsedDays !== clock.day) {
    throw new Error(`${label} campaign date/day mismatch: expected day ${elapsedDays} from ${startDate}, got day ${clock.day} at ${clock.date}`);
  }
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function createWorld(catalog, options = {}) {
  if (!catalog?.universe || !catalog?.contentHash) throw new TypeError("A validated content catalog is required");
  const seed = hashSeed(options.seed ?? Date.now());
  const randomStreams = new NamedRandomStreams(seed);
  const colonies = {};
  const populationGroupsByColony = new Map();
  for (const group of catalog.populationGroups?.values?.() || []) {
    if (!populationGroupsByColony.has(group.colonyId)) populationGroupsByColony.set(group.colonyId, []);
    populationGroupsByColony.get(group.colonyId).push(group);
  }
  for (const definition of catalog.colonies.values()) {
    const populationGroups = createPopulationGroups(
      definition.population,
      populationGroupsByColony.get(definition.id) || []
    );
    colonies[definition.id] = {
      id: definition.id,
      population: getPopulationTotal(populationGroups),
      populationGroups,
      stability: definition.stability,
      stockpiles: { ...definition.stockpiles },
      industries: definition.industries.map((industry) => ({ ...industry })),
      lastProduction: {},
      lastProductionReport: null,
      lastNeedsReport: null
    };
  }

  const markets = {};
  for (const definition of catalog.markets.values()) {
    const prices = {};
    for (const commodityId of definition.commodityIds || []) {
      prices[commodityId] = catalog.commodities.get(commodityId).basePrice;
    }
    for (const securityId of definition.securityIds || []) {
      prices[securityId] = catalog.securities.get(securityId).initialPrice;
    }
    markets[definition.id] = { id: definition.id, prices, lastChanges: {} };
  }

  const fleets = {};
  for (const definition of catalog.fleets.values()) {
    fleets[definition.id] = {
      id: definition.id,
      locationId: definition.locationId,
      factionId: definition.factionId,
      ships: definition.ships.map((ship) => ({ ...ship })),
      readiness: definition.readiness,
      morale: definition.morale,
      stance: definition.stance,
      orders: []
    };
  }

  const wars = {};
  for (const definition of catalog.wars.values()) {
    wars[definition.id] = {
      id: definition.id,
      status: definition.status,
      participants: [...definition.participants],
      startedOn: definition.startedOn,
      daysActive: Math.max(0, Math.floor((Date.parse(catalog.universe.startDate + "T00:00:00Z")
        - Date.parse(definition.startedOn + "T00:00:00Z")) / 86400000)),
      warWeariness: Object.fromEntries(definition.participants.map((id) => [id, 0]))
    };
  }

  const playerFactionId = options.playerFactionId || catalog.universe.defaultPlayerFactionId;
  const playerAccountId = catalog.universe.playerAccountId;
  const finance = createFinancialLedger({
    playerFactionId,
    playerAccountId,
    startDate: catalog.universe.startDate,
    currencies: [...catalog.currencies.values()],
    accounts: [...catalog.financialAccounts.values()].map((account) => ({
      ...account,
      currencyCode: catalog.currencies.get(account.currencyId).code
    }))
  });


  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    contentHash: catalog.contentHash,
    metadata: {
      name: options.name || localized(catalog, "simulation.world_name", { universe: localized(catalog, catalog.universe.nameKey) }),
      seed,
      createdAt: options.createdAt || new Date().toISOString()
    },
    universeId: catalog.universe.id,
    clock: createClock(catalog.universe.startDate),
    scheduler: { lastRunDayBySystem: {} },
    triggerQueue: createTriggerQueue(),
    rng: randomStreams.snapshot(),
    audit: { calculations: [] },
    domainEventSequence: 0,
    domainEvents: [],
    commandReceipts: [],
    modState: {},
    player: { factionId: playerFactionId, accountId: playerAccountId },
    finance,
    colonies,
    markets,
    fleets,
    wars,
    events: [{
      id: "world-founded",
      day: 0,
      date: catalog.universe.startDate,
      type: "system",
      text: localized(catalog, "simulation.world_founded", { universe: localized(catalog, catalog.universe.nameKey) })
    }]
  };
}

const simulationRegistryCache = new WeakMap();

function getSimulationRegistry(catalog) {
  if (!simulationRegistryCache.has(catalog)) {
    const modRuntime = getModRuntime(catalog);
    const definitions = (catalog.simulationSystems || []).map((definition) => ({
      id: definition.id,
      cadence: definition.cadence,
      order: definition.order,
      dependsOn: definition.dependsOn,
      update: (context) => {
        const result = runModHook(modRuntime, definition.hookId, {
          day: context.day,
          date: context.date,
          systemId: definition.id,
          world: context.world,
          catalog: catalog.serializable
        }, {
          world: context.world,
          catalog,
          day: context.day,
          subjectKey: definition.id,
          emitDomainEvent: context.emitDomainEvent,
          randomStreams: context.randomStreams
        });
        context.summary.systems[definition.id] = result;
      }
    }));
    simulationRegistryCache.set(catalog, createSystemRegistry(definitions));
  }
  return simulationRegistryCache.get(catalog);
}

function appendEvent(world, event) {
  world.events.push(event);
  if (world.events.length > LOG_LIMIT) world.events.splice(0, world.events.length - LOG_LIMIT);
}

function validateWorldState(world, catalog) {
  if (!world || typeof world !== "object" || world.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    throw new Error("Unsupported or invalid game-state schema");
  }
  if (world.contentHash !== catalog.contentHash) {
    const canUpgradeLegacyFingerprint = world.contentHashUpgradePending === true
      && (
        world.contentHash === catalog.legacyContentHash
        || (Array.isArray(catalog.compatibleLegacyContentHashes)
          && catalog.compatibleLegacyContentHashes.includes(world.contentHash))
      );
    const canUpgradeKnownPopulationClassification = Array.isArray(catalog.compatibleContentHashes)
      && catalog.compatibleContentHashes.includes(world.contentHash);
    if (!canUpgradeLegacyFingerprint && !canUpgradeKnownPopulationClassification) {
      throw new Error("This save was created with different Mod content. Restore the matching Mods before loading.");
    }
    world.contentHash = catalog.contentHash;
  }
  if (world.contentHashUpgradePending !== undefined) delete world.contentHashUpgradePending;
  if (world.universeId !== catalog.universe.id) throw new Error("Save universe does not match the loaded content");
  if (!Number.isInteger(world.rng?.seed) || !world.rng?.streams || typeof world.rng.streams !== "object" || Array.isArray(world.rng.streams)) {
    throw new Error("Save has an invalid named random state");
  }
  new NamedRandomStreams(world.rng.seed, world.rng.streams);
  if (!world.audit || !Array.isArray(world.audit.calculations)) throw new Error("Save has an invalid calculation audit");
  validateDomainEventState(world);
  validateCommandReceiptState(world);
  if (!world.clock || typeof world.clock.date !== "string" || !Number.isInteger(world.clock.day) || world.clock.day < 0
    || !Number.isFinite(world.clock.dayFraction) || world.clock.dayFraction < 0 || world.clock.dayFraction >= 1) {
    throw new Error("Save has an invalid game clock");
  }
  validateCampaignClock(world.clock, catalog.universe.startDate, "Save");
  if (!world.scheduler || typeof world.scheduler !== "object" || !world.scheduler.lastRunDayBySystem
    || typeof world.scheduler.lastRunDayBySystem !== "object") throw new Error("Save has an invalid simulation scheduler state");
  for (const id of catalog.colonies.keys()) {
    const colony = world.colonies?.[id];
    if (!colony || !colony.stockpiles || !Array.isArray(colony.industries)) throw new Error(`Save is missing or has invalid colony state: ${id}`);
    if (!Number.isFinite(colony.population) || colony.population < 0 || !Number.isFinite(colony.stability) || colony.stability < 0 || colony.stability > 100) {
      throw new Error(`Save has invalid colony population or stability: ${id}`);
    }
    const population = getPopulationTotal(colony.populationGroups);
    validatePopulationGroups(colony.populationGroups, undefined, `colony ${id}`);
    if (colony.population !== population) {
      throw new Error(`Save has a stale colony population projection: ${id}`);
    }
    for (const [commodityId, quantity] of Object.entries(colony.stockpiles)) {
      if (!catalog.commodities.has(commodityId) || !Number.isFinite(quantity) || quantity < 0) throw new Error(`Save has invalid stockpile quantity: ${id}.${commodityId}`);
    }
  }
  for (const [id, definition] of catalog.markets) {
    const market = world.markets?.[id];
    if (!market || !market.prices || !market.lastChanges) throw new Error(`Save is missing or has invalid market state: ${id}`);
    for (const instrumentId of [...(definition.commodityIds || []), ...(definition.securityIds || [])]) {
      const price = market.prices[instrumentId];
      if (!Number.isFinite(price) || price <= 0) throw new Error(`Save has invalid market price: ${id}.${instrumentId}`);
      if (!Number.isFinite(market.lastChanges[instrumentId] ?? 0)) throw new Error(`Save has invalid market change: ${id}.${instrumentId}`);
    }
  }
  for (const id of catalog.fleets.keys()) if (!world.fleets?.[id]) throw new Error(`Save is missing fleet state: ${id}`);
  for (const [id, definition] of catalog.wars) {
    const war = world.wars?.[id];
    if (!war || !Number.isInteger(war.daysActive) || war.daysActive < 0 || !war.warWeariness) throw new Error(`Save has invalid war state: ${id}`);
    for (const factionId of definition.participants) if (!Number.isFinite(war.warWeariness[factionId]) || war.warWeariness[factionId] < 0) throw new Error(`Save has invalid war weariness: ${id}.${factionId}`);
  }
  validateWorldFinancialState(world);
  validateModState(world.modState);
  return true;
}

function settleDay(world, catalog) {
  const randomStreams = new NamedRandomStreams(world.rng.seed, world.rng.streams);
  const modRuntime = getModRuntime(catalog);
  const calculations = createCalculationService({ definitions: modRuntime.formulaDefinitions() });
  world.clock = advanceClock(world.clock, 1);
  const summary = { systems: {} };
  const recordDomainEvent = createDomainEventEmitter(world, world.clock);
  const emitDomainEvent = (input) => {
    const previousSequence = world.domainEventSequence;
    const event = recordDomainEvent(input);
    if (event.sequence > previousSequence) activateDomainEventTriggers(world, event);
    return event;
  };
  const triggersProcessed = processDueTriggers(world, {
    day: world.clock.day,
    date: world.clock.date,
    catalog,
    resolutions: triggerResolutions,
    calculations,
    randomStreams,
    applyEffect: ({ event, effect, index }) => {
      const result = applyModEffect(effect, world, catalog, event.sourceId);
      emitDomainEvent({
        type: "mod.effect-applied",
        scope: "mod",
        subjectId: event.sourceId,
        idempotencyKey: "trigger:" + event.triggerId + ":effect:" + index,
        payload: {
          modId: event.sourceId,
          triggerId: event.triggerId,
          resolutionType: event.type,
          effectType: effect.type,
          input: effect.payload,
          result
        }
      });
      return result;
    },
    emitDomainEvent
  });
  runModHook(modRuntime, "campaign.before-day", {
    day: world.clock.day, date: world.clock.date, world
  }, { world, catalog, day: world.clock.day, emitDomainEvent, randomStreams });
  const systemsRun = getSimulationRegistry(catalog).runDue({
    world, day: world.clock.day,
    context: { catalog, randomStreams, calculations, summary, emitDomainEvent, modRuntime }
  });

  runModHook(modRuntime, "campaign.after-day", {
    day: world.clock.day, date: world.clock.date, world, summary, systemsRun
  }, { world, catalog, day: world.clock.day, emitDomainEvent, randomStreams });

  world.rng = randomStreams.snapshot();
  if (!world.audit || typeof world.audit !== "object") world.audit = { calculations: [] };
  if (!Array.isArray(world.audit.calculations)) world.audit.calculations = [];
  const calculationRecords = calculations.getRecords();
  world.audit.calculations.push(...calculationRecords);
  if (world.audit.calculations.length > CALCULATION_AUDIT_LIMIT) {
    world.audit.calculations.splice(0, world.audit.calculations.length - CALCULATION_AUDIT_LIMIT);
  }

  const report = localized(catalog, "simulation.day_report", {
    day: world.clock.day,
    system_count: systemsRun.length
  });
  appendEvent(world, {
    id: `day-${world.clock.day}`, day: world.clock.day, date: world.clock.date,
    type: "daily-report", text: report, systemsRun
  });
  return { day: world.clock.day, date: world.clock.date, summary, systemsRun, triggersProcessed, calculations: calculationRecords };
}

function validateDayInputs(world, catalog) {
  if (!world || world.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    throw new Error("DAY_INPUT unsupported or invalid game-state schema");
  }
  if (world.contentHash !== catalog.contentHash) {
    throw new Error("This save was created with different Mod content. Restore the matching Mods before loading.");
  }
  if (world.universeId !== catalog.universe.id) throw new Error("Save universe does not match the loaded content");
  if (!world?.clock || !Number.isInteger(world.clock.day) || world.clock.day < 0 || typeof world.clock.date !== "string") {
    throw new Error("DAY_INPUT world.clock.day/date is missing or invalid");
  }
  validateCampaignClock(world.clock, catalog.universe.startDate, "DAY_INPUT");
  if (!world.rng || !Number.isInteger(world.rng.seed) || !world.rng.streams || typeof world.rng.streams !== "object") {
    throw new Error("DAY_INPUT world.rng seed/streams is missing or invalid");
  }
  if (!world.modState || typeof world.modState !== "object" || Array.isArray(world.modState)) {
    throw new Error("DAY_INPUT world.modState is missing or invalid");
  }
  if (!world.scheduler?.lastRunDayBySystem || typeof world.scheduler.lastRunDayBySystem !== "object") {
    throw new Error("DAY_INPUT world.scheduler.lastRunDayBySystem is missing");
  }
  validateTriggerQueue(world, { modIds: catalog.modIds, isEventRegistered: (id) => triggerResolutions.has(id) });
  if (!Array.isArray(world.events) || !Array.isArray(world.domainEvents) || !Number.isInteger(world.domainEventSequence)) {
    throw new Error("DAY_INPUT world event history state is missing or invalid");
  }
  for (const id of catalog.colonies.keys()) {
    const colony = world.colonies?.[id];
    if (!colony || !colony.stockpiles || !Array.isArray(colony.industries)) {
      throw new Error("DAY_INPUT required colony data is missing: " + id);
    }
    const population = getPopulationTotal(colony.populationGroups);
    if (colony.population !== population) {
      throw new Error("DAY_INPUT colony population projection does not match its groups: " + id);
    }
    if (population <= 0) {
      throw new Error("DAY_INPUT colony population must be greater than zero: " + id);
    }
    if (!Number.isFinite(colony.stability) || colony.stability < 0 || colony.stability > 100) {
      throw new Error("DAY_INPUT colony stability is invalid: " + id);
    }
    for (const industry of colony.industries) {
      if (!catalog.recipes.has(industry.recipeId) || !Number.isFinite(industry.level) || industry.level <= 0) {
        throw new Error("DAY_INPUT industry recipe/level is missing or invalid: " + id + "." + industry.recipeId);
      }
    }
  }
  for (const [id, definition] of catalog.markets) {
    const market = world.markets?.[id];
    if (!market?.prices || !market.lastChanges) throw new Error("DAY_INPUT market state is missing: " + id);
    if (!world.colonies?.[definition.colonyId]) throw new Error("DAY_INPUT market references a missing colony: " + id + "." + definition.colonyId);
    for (const instrumentId of [...(definition.commodityIds || []), ...(definition.securityIds || [])]) {
      const price = market.prices[instrumentId];
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("DAY_INPUT required market price must be greater than zero: " + id + "." + instrumentId);
      }
    }
  }
  for (const id of catalog.fleets.keys()) {
    if (!world.fleets?.[id]) throw new Error("DAY_INPUT fleet state is missing: " + id);
  }
  for (const [id, definition] of catalog.wars) {
    const war = world.wars?.[id];
    if (!war || !Number.isInteger(war.daysActive) || war.daysActive < 0 || !war.warWeariness) {
      throw new Error("DAY_INPUT war state is missing or invalid: " + id);
    }
    for (const factionId of definition.participants) {
      if (!Number.isFinite(war.warWeariness[factionId]) || war.warWeariness[factionId] < 0) {
        throw new Error("DAY_INPUT war weariness is missing or invalid: " + id + "." + factionId);
      }
    }
  }
  validateWorldFinancialState(world);
}

function advanceDay(world, catalog, { eventBus = null, onDaySettled = null } = {}) {
  if (eventBus !== null && (!eventBus || typeof eventBus.publish !== "function")) {
    throw new TypeError("A domain event bus must provide publish(event)");
  }
  validateDayInputs(world, catalog);
  const previousEventSequence = world.domainEventSequence;
  const candidate = structuredClone(world);
  const detail = settleDay(candidate, catalog);

  for (const key of Object.keys(world)) delete world[key];
  Object.assign(world, candidate);

  if (eventBus) {
    for (const event of world.domainEvents) {
      if (event.sequence > previousEventSequence) eventBus.publish(event);
    }
  }
  if (typeof onDaySettled === "function") onDaySettled(world, detail);
  return world;
}

function advanceCampaignTime(world, catalog, elapsedGameDays, options = {}) {
  const targetClock = advanceClockTime(world.clock, elapsedGameDays);
  const daysToAdvance = targetClock.day - world.clock.day;
  if (daysToAdvance > MAX_CAMPAIGN_CATCH_UP_DAYS) {
    throw new RangeError(`A single campaign-time update cannot exceed ${MAX_CAMPAIGN_CATCH_UP_DAYS} whole days`);
  }
  for (let index = 0; index < daysToAdvance; index += 1) advanceDay(world, catalog, options);
  world.clock.dayFraction = targetClock.dayFraction;
  return { daysAdvanced: daysToAdvance, dayFraction: world.clock.dayFraction, world };
}

function migrateWorldState(world) {
  if (!world || typeof world !== "object" || Array.isArray(world)) throw new TypeError("Invalid saved world");
  if (![1, 2, 3, 4, 5, 6, 7, 8, GAME_STATE_SCHEMA_VERSION].includes(world.schemaVersion)) {
    throw new Error("Unsupported or invalid game-state schema: " + world.schemaVersion);
  }
  if (!world.clock || typeof world.clock.date !== "string" || !Number.isInteger(world.clock.day)) {
    throw new Error("Saved world has an invalid game clock");
  }
  if (world.schemaVersion === 1) {
    world.clock.dayFraction = 0;
    world.scheduler = { lastRunDayBySystem: {} };
  }
  if (world.clock.dayFraction === undefined) world.clock.dayFraction = 0;
  if (!world.scheduler) world.scheduler = { lastRunDayBySystem: {} };
  if (!world.scheduler.lastRunDayBySystem) world.scheduler.lastRunDayBySystem = {};

  if (world.schemaVersion < 3) {
    const legacySeed = Number.isInteger(world.rng?.seed) ? world.rng.seed : 0x6d2b79f5;
    world.rng = { seed: hashSeed(legacySeed), streams: {} }; world.audit = { calculations: [] }; world.schemaVersion = 3;
  } else {
    if (!world.rng || !world.rng.streams) world.rng = { seed: hashSeed(world.rng?.seed ?? 0x6d2b79f5), streams: {} };
    if (!world.audit || !Array.isArray(world.audit.calculations)) world.audit = { calculations: [] };
  }
  if (world.schemaVersion < 4) { world.domainEventSequence = 0; world.domainEvents = []; world.schemaVersion = 4; }
  if (world.schemaVersion < 5) { world.commandReceipts = []; world.schemaVersion = 5; }
  if (!Array.isArray(world.commandReceipts)) world.commandReceipts = [];
  if (world.schemaVersion < 6) {
    const legacyAccount = world.player?.account || { cash: 0, holdings: {} };
    if (!Number.isFinite(legacyAccount.cash) || legacyAccount.cash < 0 || legacyAccount.cash * 100 > Number.MAX_SAFE_INTEGER) throw new Error("Legacy player cash cannot be migrated safely");
    const positions = legacyAccount.holdings && typeof legacyAccount.holdings === "object" && !Array.isArray(legacyAccount.holdings) ? legacyAccount.holdings : {};
    world.finance = createLegacyFinancialLedger({ playerFactionId: world.player.factionId, startDate: world.clock.date, openingDay: world.clock.day, startingBalanceMinor: Math.round(legacyAccount.cash * 100), positions });
    world.player.accountId = "player-main";
    delete world.player.account;
    world.schemaVersion = 6;
  }
  if (world.schemaVersion < 7) {
    if (world.modState === undefined) world.modState = {};
    validateModState(world.modState);
    world.contentHashUpgradePending = true;
    world.schemaVersion = 7;
  }
  if (world.schemaVersion < 8) {
    if (!world.colonies || typeof world.colonies !== "object" || Array.isArray(world.colonies)) {
      throw new Error("Saved world has invalid colony state for population-group migration");
    }
    for (const [id, colony] of Object.entries(world.colonies)) {
      if (!colony || !Number.isFinite(colony.population) || colony.population < 0) {
        throw new Error("Saved colony has invalid population during migration: " + id);
      }
      if (!Object.hasOwn(colony, "populationGroups")) {
        colony.populationGroups = createPopulationGroups(colony.population);
      }
      const population = getPopulationTotal(colony.populationGroups);
      validatePopulationGroups(colony.populationGroups, undefined, "colony " + id);
      if (Object.hasOwn(colony, "population") && colony.population !== population) {
        throw new Error("Saved colony population projection does not match its groups: " + id);
      }
      colony.population = population;
    }
    world.schemaVersion = 8;
  }
  if (world.schemaVersion < 9) {
    world.triggerQueue = createTriggerQueue();
    world.schemaVersion = 9;
  }
  return world;
}

function advanceDays(world, catalog, days = 1, options = {}) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_ADVANCE_DAYS) {
    throw new RangeError(`A single time-advance request must be between 1 and ${MAX_ADVANCE_DAYS} days`);
  }
  for (let day = 0; day < days; day += 1) advanceDay(world, catalog, options);
  return world;
}

function createSnapshot(world, catalog) {
  const systems = [...catalog.systems.values()].map((system) => ({
    ...system,
    locations: system.locationIds.map((id) => catalog.locations.get(id))
  }));
  const colonies = [...catalog.colonies.values()].map((definition) => ({
    ...definition,
    state: world.colonies[definition.id],
    faction: catalog.factions.get(definition.factionId),
    location: catalog.locations.get(definition.locationId)
  }));
  const markets = [...catalog.markets.values()].map((definition) => ({
    ...definition,
    state: world.markets[definition.id],
    instruments: [
      ...(definition.commodityIds || []).map((id) => ({
        id, kind: "commodity", name: localized(catalog, catalog.commodities.get(id).nameKey),
        unit: localized(catalog, catalog.commodities.get(id).unitKey), price: world.markets[definition.id].prices[id],
        change: world.markets[definition.id].lastChanges[id] || 0,
        stock: world.colonies[definition.colonyId].stockpiles[id] || 0
      })),
      ...(definition.securityIds || []).map((id) => ({
        id, kind: "equity", name: localized(catalog, catalog.securities.get(id).nameKey),
        ticker: catalog.securities.get(id).ticker, unit: "股",
        price: world.markets[definition.id].prices[id],
        change: world.markets[definition.id].lastChanges[id] || 0
      }))
    ]
  }));
  const fleets = [...catalog.fleets.values()].map((definition) => ({
    ...definition, state: world.fleets[definition.id],
    faction: catalog.factions.get(definition.factionId)
  }));
  const wars = [...catalog.wars.values()].map((definition) => ({
    ...definition, state: world.wars[definition.id]
  }));
  return {
    world,
    universe: catalog.universe,
    localization: catalog.localizations?.[catalog.defaultLocale] || {},
    locale: catalog.defaultLocale || "zh-CN",
    systems,
    factions: [...catalog.factions.values()],
    colonies,
    markets,
    fleets,
    wars,
    commodities: [...catalog.commodities.values()],
    recipes: [...catalog.recipes.values()],
    shipClasses: [...catalog.shipClasses.values()],
    tradeRoutes: [...catalog.tradeRoutes.values()],
    companies: [...catalog.companies.values()],
    recentEvents: [...world.events].slice(-8).reverse()
  };
}

module.exports = {
  GAME_STATE_SCHEMA_VERSION, MAX_ADVANCE_DAYS, MAX_CAMPAIGN_CATCH_UP_DAYS,
  createWorld, advanceDay, advanceCampaignTime, migrateWorldState,
  advanceDays, validateWorldState, createSnapshot
};
