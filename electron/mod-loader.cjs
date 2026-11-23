"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { MAX_INI_BYTES, parseIni } = require("./ini-parser.cjs");

const MOD_API_VERSION = 4;
const SUPPORTED_API_VERSIONS = new Set([3, MOD_API_VERSION]);
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_SCRIPT_BYTES = 256 * 1024;
const MAX_MOD_SCRIPTS = 16;
const MAX_MOD_HOOKS = 64;
const MAX_MOD_SYSTEMS = 64;
const MAX_MOD_FORMULAS = 64;
const CATEGORIES = ["registry", "content", "localization"];
const TYPE_FILES = {
  universe: "universes",
  system: "systems",
  location: "locations",
  trade_route: "tradeRoutes",
  faction: "factions",
  colony: "colonies",
  commodity: "commodities",
  recipe: "recipes",
  market: "markets",
  company: "companies",
  security: "securities",
  ship_class: "shipClasses",
  fleet: "fleets",
  war: "wars",
  event: "events",
  profession: "professions",
  wealth_tier: "wealthTiers",
  population_group: "populationGroups",
  currency: "currencies",
  financial_account: "financialAccounts"
};
const LIST_FIELDS = new Set([
  "links", "location_ids", "colony_ids", "commodity_ids", "security_ids",
  "participants", "fleet_ids", "tags"
]);

function isSafeModId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9._-]{1,63}$/.test(id);
}

function isSafeModFile(file) {
  return typeof file === "string" && /^[a-zA-Z0-9_-]{1,64}\.ini$/.test(file);
}

function isSafeModScript(file) {
  return typeof file === "string" && /^[a-zA-Z0-9_-]{1,64}\.js$/.test(file);
}

function isSafeHookId(id) {
  return typeof id === "string" && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id);
}

function splitList(value) {
  return typeof value === "string" && value.trim()
    ? value.split(";").map((item) => item.trim()).filter(Boolean)
    : [];
}

function tuple(value, expectedLength, label) {
  if (typeof value !== "string") throw new Error("Invalid " + label + " tuple");
  const parts = value.split(":");
  if (parts.length !== expectedLength || parts.some((item) => !item.trim())) {
    throw new Error("Invalid " + label + " tuple: " + value);
  }
  return parts;
}

function camel(key) {
  return key.replace(/_([a-z])/g, (_, character) => character.toUpperCase());
}

function normalizeEntity(section, id, type) {
  const entity = { id };
  for (const [key, value] of Object.entries(section)) {
    if (/^(stockpile|industry|input|output|ship|dimension)\./.test(key)
      || key === "position_x" || key === "position_y") continue;
    entity[camel(key)] = LIST_FIELDS.has(key) ? splitList(value) : value;
  }

  if (section.position_x !== undefined || section.position_y !== undefined) {
    entity.position = { x: section.position_x, y: section.position_y };
  }
  if (type === "population_group") {
    entity.dimensions = {};
    for (const [key, value] of Object.entries(section)) {
      if (!key.startsWith("dimension.")) continue;
      const dimensionId = key.slice("dimension.".length);
      if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(dimensionId)) {
        throw new Error("Invalid population dimension ID in " + file + ": " + dimensionId);
      }
      const distribution = {};
      for (const entry of splitList(value)) {
        const [categoryId, rawProportion] = tuple(entry, 2, "population dimension").map((part) => part.trim());
        if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(categoryId)) {
          throw new Error("Invalid population category ID in " + file + ": " + categoryId);
        }
        if (Object.hasOwn(distribution, categoryId)) {
          throw new Error("Duplicate population category in " + file + ": " + dimensionId + "." + categoryId);
        }
        distribution[categoryId] = Number(rawProportion);
      }
      entity.dimensions[dimensionId] = distribution;
    }
  }
  if (type === "colony") {
    entity.stockpiles = {};
    for (const [key, value] of Object.entries(section)) {
      if (key.startsWith("stockpile.")) entity.stockpiles[key.slice(10)] = value;
    }
    entity.industries = Object.entries(section)
      .filter(([key]) => key.startsWith("industry."))
      .sort(([a], [b]) => Number(a.slice(9)) - Number(b.slice(9)))
      .map(([, value]) => {
        const [recipeId, level, companyId] = tuple(value, 3, "industry");
        return { recipeId, level: Number(level), ...(companyId === "-" ? {} : { companyId }) };
      });
  }
  if (type === "recipe") {
    for (const [key, output] of [["input", "inputs"], ["output", "outputs"]]) {
      entity[output] = Object.entries(section)
        .filter(([field]) => field.startsWith(key + "."))
        .sort(([a], [b]) => Number(a.slice(key.length + 1)) - Number(b.slice(key.length + 1)))
        .map(([, value]) => {
          const [commodityId, quantity] = tuple(value, 2, key);
          return { commodityId, quantity: Number(quantity) };
        });
    }
  }
  if (type === "fleet") {
    entity.ships = Object.entries(section)
      .filter(([key]) => key.startsWith("ship."))
      .sort(([a], [b]) => Number(a.slice(5)) - Number(b.slice(5)))
      .map(([, value]) => {
        const [shipClassId, quantity] = tuple(value, 2, "ship");
        return { shipClassId, quantity: Number(quantity) };
      });
  }
  return entity;
}

function normalizeContentIni(data, file) {
  const output = {};
  for (const [sectionName, section] of Object.entries(data)) {
    if (sectionName === "universe") {
      output.universe = normalizeEntity(section, section.id, "universe");
      continue;
    }
    const dot = sectionName.indexOf(".");
    if (dot <= 0) continue;
    const type = sectionName.slice(0, dot);
    const id = sectionName.slice(dot + 1);
    const collection = TYPE_FILES[type];
    if (!collection) throw new Error("Unknown content section [" + sectionName + "] in " + file);
    if (!output[collection]) output[collection] = [];
    output[collection].push(normalizeEntity(section, id, type));
  }
  return output;
}

function normalizeRegistryIni(data, file) {
  const entries = Object.entries(data)
    .filter(([key]) => key.startsWith("entry."))
    .map(([key, value]) => ({ id: key.slice(6), type: value.type }));
  if (!entries.length) throw new Error(file + ": no [entry.<id>] sections found");
  if (entries.some((entry) => typeof entry.type !== "string")) {
    throw new Error(file + ": registry entry missing type");
  }
  return { entries };
}

function fileList(value, label) {
  if (typeof value !== "string") {
    throw new Error("Manifest [files]." + label + " must be a semicolon-separated list");
  }
  return splitList(value);
}

function parseHookDeclarations(section, scriptFiles, apiVersion, modId) {
  if (apiVersion < 4) {
    if (section && Object.keys(section).length) {
      throw new Error("Mod " + modId + " must use API version 4 for JavaScript hooks");
    }
    return {};
  }
  const hooks = section || {};
  const entries = Object.entries(hooks);
  if (entries.length > MAX_MOD_HOOKS) throw new Error("Mod " + modId + " declares too many hooks");
  const output = {};
  for (const [hookId, target] of entries) {
    if (!isSafeHookId(hookId) || typeof target !== "string") {
      throw new Error("Mod " + modId + " has an invalid hook declaration: " + hookId);
    }
    const separator = target.lastIndexOf(":");
    const file = target.slice(0, separator);
    const handler = target.slice(separator + 1);
    if (separator <= 0 || !isSafeModScript(file)
      || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(handler)
      || !scriptFiles.includes(file)) {
      throw new Error("Mod " + modId + " hook " + hookId + " must target a declared script function");
    }
    output[hookId] = file + ":" + handler;
  }
  return output;
}

function parseFormulaDeclarations(section, scriptFiles, apiVersion, modId) {
  const entries = Object.entries(section || {});
  if (apiVersion < 4 && entries.length) throw new Error("Mod " + modId + " must use API version 4 for formulas");
  if (entries.length > MAX_MOD_FORMULAS) throw new Error("Mod " + modId + " declares too many formulas");
  const output = {};
  for (const [formulaId, target] of entries) {
    if (!isSafeHookId(formulaId) || typeof target !== "string") {
      throw new Error("Mod " + modId + " has an invalid formula declaration: " + formulaId);
    }
    const [file, handler, rawVersion, ...extra] = target.split(":");
    const version = Number(rawVersion);
    if (extra.length || !isSafeModScript(file) || !scriptFiles.includes(file)
      || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(handler)
      || !/^\d+$/.test(rawVersion || "") || !Number.isSafeInteger(version) || version < 1) {
      throw new Error("Mod " + modId + " formula " + formulaId + " must target a declared script function and positive version");
    }
    output[formulaId] = { file, handler, version };
  }
  return output;
}

function parseSimulationSystems(section, hooks, apiVersion, modId) {
  const entries = Object.entries(section || {});
  if (apiVersion < 4 && entries.length) throw new Error("Mod " + modId + " must use API version 4 for simulation systems");
  if (entries.length > MAX_MOD_SYSTEMS) throw new Error("Mod " + modId + " declares too many simulation systems");
  const cadences = new Set(["annual", "monthly", "weekly", "daily", "manual"]);
  const output = [];
  for (const [localId, declaration] of entries) {
    if (!isSafeHookId(localId) || typeof declaration !== "string") {
      throw new Error("Mod " + modId + " has an invalid simulation-system declaration: " + localId);
    }
    const [cadence, rawOrder, rawDependencies, hookId, ...extra] = declaration.split(":");
    const order = Number(rawOrder);
    const dependsOn = rawDependencies === "-" ? [] : splitList(rawDependencies);
    if (extra.length || !cadences.has(cadence) || !/^-?\d+$/.test(rawOrder || "")
      || !Number.isSafeInteger(order) || !isSafeHookId(hookId)
      || !hookId.startsWith(modId + ".") || !Object.hasOwn(hooks, hookId)
      || dependsOn.some((id) => !isSafeHookId(id)) || new Set(dependsOn).size !== dependsOn.length) {
      throw new Error("Mod " + modId + " simulation system " + localId
        + " requires cadence:order:dependencies:own-namespaced-hook");
    }
    output.push({ id: modId + "." + localId, modId, cadence, order, dependsOn, hookId });
  }
  return output;
}

async function readCategory(directory, category, declared) {
  if (!Array.isArray(declared) || declared.some((file) => !isSafeModFile(file))) {
    throw new Error("Invalid " + category + " file declaration: only .ini files are supported");
  }
  if (new Set(declared).size !== declared.length) {
    throw new Error("Duplicate " + category + " file declaration");
  }
  const output = {};
  if (!declared.length) return output;
  const categoryPath = path.join(directory, category);
  const stat = await fs.lstat(categoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Mod " + category + "/ directory is missing or linked");
  }
  if ((await fs.readdir(categoryPath)).some((file) => file.toLowerCase().endsWith(".json"))) {
    throw new Error("JSON files are forbidden in Mod " + category + "/; use INI");
  }
  for (const file of declared) {
    const filePath = path.join(categoryPath, file);
    const fileStat = await fs.lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size > MAX_INI_BYTES) {
      throw new Error(category + " file is missing, linked or too large: " + file);
    }
    output[file] = parseIni(await fs.readFile(filePath, "utf8"), { rejectInlineJson: true });
  }
  return output;
}

async function readScripts(directory, declared) {
  if (!Array.isArray(declared) || declared.some((file) => !isSafeModScript(file))) {
    throw new Error("Invalid script declaration: only simple .js filenames are supported");
  }
  if (declared.length > MAX_MOD_SCRIPTS) throw new Error("A Mod may declare at most " + MAX_MOD_SCRIPTS + " JavaScript files");
  if (new Set(declared).size !== declared.length) throw new Error("Duplicate Mod script declaration");
  const output = {};
  if (!declared.length) return output;

  const scriptDirectory = path.join(directory, "scripts");
  const stat = await fs.lstat(scriptDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Mod scripts/ directory is missing or linked");
  }
  const entries = await fs.readdir(scriptDirectory);
  if (entries.some((file) => file.toLowerCase().endsWith(".json"))) {
    throw new Error("JSON files are not supported in Mod scripts/");
  }
  const undeclared = entries.filter((file) => file.toLowerCase().endsWith(".js") && !declared.includes(file));
  if (undeclared.length) throw new Error("Undeclared JavaScript files in Mod scripts/: " + undeclared.join(", "));

  for (const file of declared) {
    const filePath = path.join(scriptDirectory, file);
    const fileStat = await fs.lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size > MAX_SCRIPT_BYTES) {
      throw new Error("Script is missing, linked or exceeds 256 KiB: " + file);
    }
    output[file] = await fs.readFile(filePath, "utf8");
  }
  return output;
}

async function readModPackages(root, options = {}) {
  const enabledMods = options.enabledMods || {};
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  const mods = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeModId(entry.name)) continue;
    const directory = path.join(root, entry.name);
    try {
      try {
        await fs.access(path.join(directory, "manifest.json"));
        throw new Error("JSON Mod manifests are forbidden; use manifest.ini");
      } catch (error) {
        if (error.message.includes("forbidden")) throw error;
        if (error.code !== "ENOENT") throw error;
      }

      const manifestPath = path.join(directory, "manifest.ini");
      const manifestStat = await fs.lstat(manifestPath);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > MAX_MANIFEST_BYTES) {
        throw new Error("Manifest is missing, linked or too large");
      }

      const parsed = parseIni(await fs.readFile(manifestPath, "utf8"), { rejectInlineJson: true });
      const meta = parsed.mod;
      const files = parsed.files;
      const apiVersion = meta?.api_version;
      if (meta && Object.keys(meta).some((key) => ["code", "code_files", "scripts", "script_files"].includes(key))) {
        throw new Error("Executable code declarations in [mod] are not supported; declare API v4 scripts under [files] and hooks under [hooks]");
      }
      if (!meta || !files || meta.id !== entry.name || typeof meta.name !== "string"
        || typeof meta.version !== "string" || typeof meta.author !== "string"
        || !SUPPORTED_API_VERSIONS.has(apiVersion)) {
        throw new Error("Invalid manifest or unsupported Mod API version");
      }

      const declarations = {
        registry: fileList(files.registry, "registry"),
        content: fileList(files.content, "content"),
        localization: fileList(files.localization, "localization"),
        scripts: files.scripts === undefined ? [] : fileList(files.scripts, "scripts")
      };
      const hooks = parseHookDeclarations(parsed.hooks, declarations.scripts, apiVersion, entry.name);
      const formulas = parseFormulaDeclarations(parsed.formulas, declarations.scripts, apiVersion, entry.name);
      const systems = parseSimulationSystems(parsed.systems, hooks, apiVersion, entry.name);
      if (apiVersion < 4 && declarations.scripts.length) {
        throw new Error("Mod " + entry.name + " must use API version 4 for JavaScript scripts");
      }

      const enabled = entry.name === "core" || enabledMods[entry.name] !== false;
      const data = {};
      for (const category of CATEGORIES) {
        data[category] = enabled ? await readCategory(directory, category, declarations[category]) : {};
      }
      const scripts = enabled ? await readScripts(directory, declarations.scripts) : {};
      if (enabled) {
        for (const [file, value] of Object.entries(data.registry)) {
          if (file === "definitions.ini") data.registry[file] = normalizeRegistryIni(value, file);
        }
        for (const [file, value] of Object.entries(data.content)) {
          data.content[file] = normalizeContentIni(value, file);
        }
      }

      mods.push({
        id: meta.id,
        name: meta.name,
        version: meta.version,
        author: meta.author,
        description: typeof meta.description === "string" ? meta.description : "",
        apiVersion,
        enabled,
        data,
        scripts,
        hooks,
        formulas,
        systems
      });
    } catch (error) {
      mods.push({
        id: entry.name,
        name: entry.name,
        version: "—",
        author: "—",
        apiVersion: null,
        error: error.message
      });
    }
  }
  return mods;
}

async function loadCoreContent(root, options = {}) {
  const mods = await readModPackages(root, options);
  const core = mods.find((mod) => mod.id === "core");
  if (!core) return { ok: false, error: "Required content package mods/core is missing", mods };
  if (core.error) return { ok: false, error: "Core content package is invalid: " + core.error, mods };
  return { ok: true, core, mods };
}

module.exports = {
  MOD_API_VERSION,
  SUPPORTED_API_VERSIONS,
  MAX_MANIFEST_BYTES,
  MAX_SCRIPT_BYTES,
  MAX_INI_BYTES,
  MAX_MOD_SCRIPTS,
  MAX_MOD_HOOKS,
  MAX_MOD_SYSTEMS,
  MAX_MOD_FORMULAS,
  CATEGORIES,
  isSafeModId,
  isSafeModFile,
  isSafeModScript,
  isSafeHookId,
  readModPackages,
  loadCoreContent
};
