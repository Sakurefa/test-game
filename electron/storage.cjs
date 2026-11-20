const fs = require("node:fs/promises");
const path = require("node:path");
const { parseIni } = require("./ini-parser.cjs");

const STORAGE_VERSION = 1;
const DEFAULT_SETTINGS = {
  general: { schema_version: STORAGE_VERSION, language: "zh-CN", window_mode: "windowed" },
  graphics: { schema_version: STORAGE_VERSION, ui_scale: 100 },
  audio: { schema_version: STORAGE_VERSION, master_volume: 100, music_volume: 100, effects_volume: 100 },
  mods: { schema_version: STORAGE_VERSION, enabled: {} }
};

function serializeIni(value) {
  const lines = [];
  for (const [sectionName, entries] of Object.entries(value)) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue;
    lines.push(`[${sectionName}]`);
    for (const [key, item] of Object.entries(entries)) {
      const encoded = typeof item === "string" ? JSON.stringify(item)
        : item === undefined ? '""'
        : JSON.stringify(item);
      lines.push(`${key} = ${encoded}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function atomicWrite(file, content) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
  try {
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function ensureWritableDirectory(directory) {
  await fs.mkdir(directory, { recursive: true });
  const probe = path.join(directory, `.write-test-${process.pid}-${Date.now()}`);
  try {
    await fs.writeFile(probe, "ok", { flag: "wx" });
    await fs.rm(probe);
  } catch (error) {
    throw new Error(`Game directory is not writable: ${directory} (${error.message})`);
  }
}

function validateSetting(group, key, value) {
  if (group === "general" && key === "window_mode") return ["windowed", "borderless", "exclusive"].includes(value);
  if (group === "graphics" && key === "ui_scale") return Number.isInteger(value) && value >= 80 && value <= 160;
  if (group === "general" && key === "language") return typeof value === "string" && /^[a-zA-Z-]{2,16}$/.test(value);
  if (group === "audio" && ["master_volume", "music_volume", "effects_volume"].includes(key)) {
    return Number.isInteger(value) && value >= 0 && value <= 100;
  }
  return false;
}

function validateGroup(group, value) {
  const defaults = DEFAULT_SETTINGS[group];
  if (!defaults || !value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid settings group: ${group}`);
  }
  const section = value[group] && typeof value[group] === "object" ? value[group] : value;
  const result = { ...defaults };
  for (const [key, item] of Object.entries(section)) {
    if (key === "schema_version") continue;
    if (group === "mods" && key === "enabled") {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("mods.enabled must be an object");
      const enabled = {};
      for (const [id, state] of Object.entries(item)) {
        if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(id) || typeof state !== "boolean") {
          throw new Error(`Invalid Mod enabled state: ${id}`);
        }
        enabled[id] = state;
      }
      result.enabled = { ...defaults.enabled, ...enabled, core: true };
      continue;
    }
    if (!validateSetting(group, key, item)) throw new Error(`Invalid setting ${group}.${key}`);
    result[key] = item;
  }
  result.schema_version = STORAGE_VERSION;
  return result;
}

async function readIniOrDefault(file, defaults) {
  try {
    const parsed = parseIni(await fs.readFile(file, "utf8"));
    const section = Object.keys(parsed)[0];
    return validateGroup(Object.keys(defaults)[0], parsed);
  } catch (error) {
    if (error.code === "ENOENT") return defaults;
    throw new Error(`Cannot read settings file ${file}: ${error.message}`);
  }
}

async function initializeStorage(root) {
  const settingDirectory = path.join(root, "setting");
  const saveDirectory = path.join(root, "save");
  const logsDirectory = path.join(root, "Logs");
  await ensureWritableDirectory(root);
  await Promise.all([
    ensureWritableDirectory(settingDirectory),
    ensureWritableDirectory(saveDirectory),
    ensureWritableDirectory(logsDirectory)
  ]);

  for (const group of Object.keys(DEFAULT_SETTINGS)) {
    const file = path.join(settingDirectory, `${group}.ini`);
    try {
      await fs.access(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await atomicWrite(file, serializeIni({ [group]: DEFAULT_SETTINGS[group] }));
    }
  }
  return { root, settingDirectory, saveDirectory, logsDirectory };
}

async function readSettings(root) {
  const settings = {};
  for (const group of Object.keys(DEFAULT_SETTINGS)) {
    const file = path.join(root, "setting", `${group}.ini`);
    try {
      const parsed = parseIni(await fs.readFile(file, "utf8"));
      settings[group] = validateGroup(group, parsed);
    } catch (error) {
      if (error.code === "ENOENT") {
        settings[group] = { ...DEFAULT_SETTINGS[group] };
        continue;
      }
      throw new Error(`Cannot load setting/${group}.ini: ${error.message}`);
    }
  }
  return settings;
}

async function writeSettings(root, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Settings update must be an object");
  const current = await readSettings(root);
  const changed = [];
  for (const [group, values] of Object.entries(patch)) {
    if (!DEFAULT_SETTINGS[group] || !values || typeof values !== "object" || Array.isArray(values)) {
      throw new Error(`Unknown settings group: ${group}`);
    }
    const merged = group === "mods"
      ? { ...current[group], ...values, enabled: { ...current[group].enabled, ...(values.enabled || {}) } }
      : { ...current[group], ...values };
    const next = validateGroup(group, { [group]: merged });
    if (group === "mods") next.enabled.core = true;
    await atomicWrite(path.join(root, "setting", `${group}.ini`), serializeIni({ [group]: next }));
    current[group] = next;
    changed.push(group);
  }
  return { settings: current, changed };
}

function isSafeSlotId(id) {
  return typeof id === "string" && /^slot_[a-zA-Z0-9_-]{1,48}$/.test(id);
}

async function listSaveSlots(root) {
  const directory = path.join(root, "save");
  await fs.mkdir(directory, { recursive: true });
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const slots = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeSlotId(entry.name)) continue;
    const slotPath = path.join(directory, entry.name);
    try {
      const raw = await fs.readFile(path.join(slotPath, "metadata.ini"), "utf8");
      const metadata = parseIni(raw).save;
      if (!metadata || typeof metadata !== "object") throw new Error("Missing [save] metadata section");
      slots.push({ id: entry.name, metadata, status: metadata.schema_version === STORAGE_VERSION ? "ok" : "incompatible" });
    } catch (error) {
      slots.push({ id: entry.name, metadata: null, status: "damaged", error: error.message });
    }
  }
  return slots;
}

async function createSaveSlot(root, id, name = "New Save") {
  if (!isSafeSlotId(id)) throw new Error("Invalid save slot ID");
  const directory = path.join(root, "save", id);
  await fs.mkdir(path.join(directory, "data"), { recursive: true });
  const metadata = {
    schema_version: STORAGE_VERSION,
    name: String(name).slice(0, 80),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  await atomicWrite(path.join(directory, "metadata.ini"), serializeIni({ save: metadata }));
  return { id, metadata, status: "ok" };
}

async function removeSaveSlot(root, id) {
  if (!isSafeSlotId(id)) throw new Error("Invalid save slot ID");
  await fs.rm(path.join(root, "save", id), { recursive: true, force: true });
}

module.exports = {
  STORAGE_VERSION, DEFAULT_SETTINGS, serializeIni, atomicWrite, initializeStorage,
  readSettings, writeSettings, listSaveSlots, createSaveSlot, removeSaveSlot, isSafeSlotId
};
