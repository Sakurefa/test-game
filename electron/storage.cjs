const fs = require("node:fs/promises");
const path = require("node:path");
const { parseIni } = require("./ini-parser.cjs");

const STORAGE_VERSION = 1;
const MAX_GAME_STATE_BYTES = 16 * 1024 * 1024;
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
  const directoryStat = await fs.lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(`Game storage directory is linked or invalid: ${directory}`);
  }
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
  const schemaVersion = section.schema_version ?? 0;
  if (!Number.isInteger(schemaVersion) || schemaVersion < 0 || schemaVersion > STORAGE_VERSION) {
    throw new Error(`Unsupported ${group} settings schema version: ${schemaVersion}`);
  }
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
      const schemaVersion = parsed[group]?.schema_version ?? 0;
      settings[group] = validateGroup(group, parsed);
      if (schemaVersion < STORAGE_VERSION) {
        await atomicWrite(file, serializeIni({ [group]: settings[group] }));
      }
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

async function getSafeSlotDirectory(root, id) {
  if (!isSafeSlotId(id)) throw new Error("Invalid save slot ID");
  const saveRoot = path.join(root, "save");
  const rootStat = await fs.lstat(saveRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Save root is linked or invalid");
  const directory = path.join(saveRoot, id);
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Save slot is not a regular directory");
  return directory;
}

async function listSaveSlots(root) {
  const directory = path.join(root, "save");
  await fs.mkdir(directory, { recursive: true });
  const rootStat = await fs.lstat(directory);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Save root is linked or invalid");
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const slots = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeSlotId(entry.name)) continue;
    const slotPath = path.join(directory, entry.name);
    try {
      const metadataPath = path.join(slotPath, "metadata.ini");
      const stat = await fs.lstat(metadataPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) {
        throw new Error("Save metadata is linked or too large");
      }
      const raw = await fs.readFile(metadataPath, "utf8");
      const metadata = parseIni(raw).save;
      if (!metadata || typeof metadata !== "object") throw new Error("Missing [save] metadata section");
      let hasWorld = false;
      try {
        const dataDirectory = path.join(slotPath, "data");
        const dataStat = await fs.lstat(dataDirectory);
        if (!dataStat.isDirectory() || dataStat.isSymbolicLink()) throw new Error("Save data directory is linked or invalid");
        const worldPath = path.join(dataDirectory, "world.json");
        const worldStat = await fs.lstat(worldPath);
        if (!worldStat.isFile() || worldStat.isSymbolicLink() || worldStat.size > MAX_GAME_STATE_BYTES) {
          throw new Error("World save is linked, invalid or too large");
        }
        hasWorld = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      slots.push({
        id: entry.name, metadata,
        status: metadata.schema_version === STORAGE_VERSION ? "ok" : "incompatible",
        hasWorld
      });
    } catch (error) {
      slots.push({ id: entry.name, metadata: null, status: "damaged", error: error.message });
    }
  }
  return slots;
}

async function createSaveSlot(root, id, name = "New Save") {
  if (!isSafeSlotId(id)) throw new Error("Invalid save slot ID");
  const saveDirectory = path.join(root, "save");
  await fs.mkdir(saveDirectory, { recursive: true });
  const saveRootStat = await fs.lstat(saveDirectory);
  if (!saveRootStat.isDirectory() || saveRootStat.isSymbolicLink()) throw new Error("Save root is linked or invalid");
  const directory = path.join(saveDirectory, id);
  await fs.mkdir(directory);
  await fs.mkdir(path.join(directory, "data"), { recursive: true });
  const metadata = {
    schema_version: STORAGE_VERSION,
    name: String(name).slice(0, 80),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  await atomicWrite(path.join(directory, "metadata.ini"), serializeIni({ save: metadata }));
  await atomicWrite(path.join(directory, "world.ini"), serializeIni({ world: { schema_version: STORAGE_VERSION } }));
  return { id, metadata, status: "ok" };
}

async function writeGameState(root, id, state) {
  if (!state || typeof state !== "object" || Array.isArray(state) || state.schemaVersion !== 1) {
    throw new Error("Invalid or unsupported game state");
  }
  const directory = await getSafeSlotDirectory(root, id);
  const dataDirectory = path.join(directory, "data");
  await fs.mkdir(dataDirectory, { recursive: true });
  const dataStat = await fs.lstat(dataDirectory);
  if (!dataStat.isDirectory() || dataStat.isSymbolicLink()) throw new Error("Save data directory is linked or invalid");
  const serialized = JSON.stringify(state, null, 2);
  if (Buffer.byteLength(serialized, "utf8") > MAX_GAME_STATE_BYTES) throw new Error("Game state exceeds the 16 MiB save limit");
  await atomicWrite(path.join(dataDirectory, "world.json"), serialized);

  const metadataPath = path.join(directory, "metadata.ini");
  const metadataStat = await fs.lstat(metadataPath);
  if (!metadataStat.isFile() || metadataStat.isSymbolicLink() || metadataStat.size > 64 * 1024) {
    throw new Error("Save metadata is linked or invalid");
  }
  const parsed = parseIni(await fs.readFile(metadataPath, "utf8"));
  if (!parsed.save) throw new Error("Save metadata is missing its [save] section");
  parsed.save.updated_at = new Date().toISOString();
  await atomicWrite(metadataPath, serializeIni(parsed));
  return true;
}

async function readGameState(root, id) {
  const directory = await getSafeSlotDirectory(root, id);
  const dataDirectory = path.join(directory, "data");
  const dataStat = await fs.lstat(dataDirectory);
  if (!dataStat.isDirectory() || dataStat.isSymbolicLink()) throw new Error("Save data directory is linked or invalid");
  const file = path.join(dataDirectory, "world.json");
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_GAME_STATE_BYTES) {
    throw new Error("Game-state file is missing, linked or too large");
  }
  const state = JSON.parse(await fs.readFile(file, "utf8"));
  if (!state || typeof state !== "object" || state.schemaVersion !== 1) throw new Error("Unsupported game-state schema");
  return state;
}

async function removeSaveSlot(root, id) {
  if (!isSafeSlotId(id)) throw new Error("Invalid save slot ID");
  const saveDirectory = path.join(root, "save");
  const saveRootStat = await fs.lstat(saveDirectory);
  if (!saveRootStat.isDirectory() || saveRootStat.isSymbolicLink()) throw new Error("Save root is linked or invalid");
  const directory = path.join(saveDirectory, id);
  try {
    const slotStat = await fs.lstat(directory);
    if (!slotStat.isDirectory() || slotStat.isSymbolicLink()) throw new Error("Save slot is linked or invalid");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  await fs.rm(directory, { recursive: true, force: true });
}

module.exports = {
  STORAGE_VERSION, MAX_GAME_STATE_BYTES, DEFAULT_SETTINGS, serializeIni, atomicWrite,
  initializeStorage, readSettings, writeSettings, listSaveSlots, createSaveSlot,
  readGameState, writeGameState, removeSaveSlot, isSafeSlotId
};
