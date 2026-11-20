const VALID_CADENCES = new Set(["daily", "weekly", "manual"]);

function assertSync(result, hook, id) {
  if (result && typeof result.then === "function") {
    throw new TypeError(`Simulation system ${id}.${hook} must be synchronous`);
  }
}

function createSystemRegistry(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new TypeError("At least one simulation system is required");
  }

  const byId = new Map();
  definitions.forEach((definition, index) => {
    if (!definition || typeof definition !== "object" || !/^[a-z][a-z0-9._-]{1,95}$/.test(definition.id || "")) {
      throw new TypeError("Every simulation system must have a stable lowercase ID");
    }
    if (byId.has(definition.id)) throw new Error(`Duplicate simulation system: ${definition.id}`);
    if (!VALID_CADENCES.has(definition.cadence)) throw new Error(`Invalid cadence for ${definition.id}: ${definition.cadence}`);
    if (definition.update !== undefined && typeof definition.update !== "function") {
      throw new TypeError(`System ${definition.id}.update must be a function`);
    }
    const dependencies = definition.dependsOn ?? [];
    if (!Array.isArray(dependencies) || dependencies.some((id) => typeof id !== "string")) {
      throw new TypeError(`System ${definition.id}.dependsOn must be an array of IDs`);
    }
    byId.set(definition.id, {
      ...definition,
      order: Number.isFinite(definition.order) ? definition.order : 100,
      dependsOn: [...new Set(dependencies)],
      _index: index
    });
  });

  for (const system of byId.values()) {
    for (const dependency of system.dependsOn) {
      if (!byId.has(dependency)) throw new Error(`System ${system.id} depends on missing system ${dependency}`);
      if (dependency === system.id) throw new Error(`System ${system.id} cannot depend on itself`);
    }
  }

  const compare = (a, b) => a.order - b.order || a._index - b._index || a.id.localeCompare(b.id);
  const remaining = new Map(byId);
  const ordered = [];
  const completed = new Set();
  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((system) => system.dependsOn.every((id) => completed.has(id)))
      .sort(compare);
    if (ready.length === 0) throw new Error("Simulation system dependency cycle detected");
    const system = ready[0];
    const { _index, ...publicSystem } = system;
    ordered.push(Object.freeze(publicSystem));
    completed.add(system.id);
    remaining.delete(system.id);
  }

  const systems = Object.freeze(ordered);
  const getSystem = (id) => systems.find((system) => system.id === id) || null;

  function executeUpdate(system, args) {
    try {
      const result = system.update?.(args);
      assertSync(result, "update", system.id);
      return result;
    } catch (error) {
      const failure = new Error(`Simulation system ${system.id}.update failed: ${error.message}`, { cause: error });
      failure.code = "SIMULATION_SYSTEM_FAILURE";
      throw failure;
    }
  }

  function initialize(context = {}) {
    for (const system of systems) {
      const result = system.initialize?.(context);
      assertSync(result, "initialize", system.id);
    }
  }

  function runDue({ world, day, context = {} }) {
    if (!world || !Number.isInteger(day) || day < 0) throw new TypeError("A world and non-negative integer day are required");
    if (!world.scheduler || typeof world.scheduler !== "object") world.scheduler = { lastRunDayBySystem: {} };
    if (!world.scheduler.lastRunDayBySystem || typeof world.scheduler.lastRunDayBySystem !== "object") {
      world.scheduler.lastRunDayBySystem = {};
    }
    const ran = [];
    for (const system of systems) {
      const due = system.cadence === "daily" ? day > 0
        : system.cadence === "weekly" ? day > 0 && day % 7 === 0
          : false;
      if (!due || world.scheduler.lastRunDayBySystem[system.id] === day) continue;
      executeUpdate(system, { ...context, world, day, systemId: system.id });
      world.scheduler.lastRunDayBySystem[system.id] = day;
      ran.push(system.id);
    }
    return ran;
  }

  function runManual({ world, id, context = {} }) {
    const system = getSystem(id);
    if (!system) throw new Error(`Unknown simulation system: ${id}`);
    if (system.cadence !== "manual") throw new Error(`Simulation system ${id} is not manually triggered`);
    if (!world || typeof world !== "object") throw new TypeError("A world is required to run a manual simulation system");
    const day = Number.isInteger(world.clock?.day) ? world.clock.day : 0;
    return executeUpdate(system, { ...context, world, day, systemId: id, manual: true });
  }

  function save(context = {}) {
    const state = {};
    for (const system of systems) {
      if (typeof system.save !== "function") continue;
      const result = system.save(context);
      assertSync(result, "save", system.id);
      state[system.id] = result;
    }
    return state;
  }

  function restore(savedState = {}, context = {}) {
    if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)) {
      throw new TypeError("Saved simulation-system state must be an object");
    }
    for (const system of systems) {
      if (typeof system.restore !== "function" || !(system.id in savedState)) continue;
      const result = system.restore(savedState[system.id], context);
      assertSync(result, "restore", system.id);
    }
  }

  function dispose(context = {}) {
    for (const system of [...systems].reverse()) {
      const result = system.dispose?.(context);
      assertSync(result, "dispose", system.id);
    }
  }

  return Object.freeze({ systems, getSystem, initialize, runDue, runManual, save, restore, dispose });
}

module.exports = { VALID_CADENCES, createSystemRegistry };
