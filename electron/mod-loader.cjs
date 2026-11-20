const fs = require("node:fs/promises");
const path = require("node:path");
const { MAX_INI_BYTES, parseIni } = require("./ini-parser.cjs");

const MOD_API_VERSION = 3;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_MOD_JSON_BYTES = 2 * 1024 * 1024;
const CATEGORIES = ["registry", "content", "localization"];

function isSafeModId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9._-]{1,63}$/.test(id);
}

function isSafeModFile(file) {
  return typeof file === "string" && /^[a-zA-Z0-9_-]{1,64}\.(ini|json)$/.test(file);
}

async function readCategory(directory, category, declaredFiles) {
  if (!Array.isArray(declaredFiles) || declaredFiles.some((file) => !isSafeModFile(file))) {
    throw new Error(`Invalid ${category} file declaration`);
  }
  if (new Set(declaredFiles).size !== declaredFiles.length) {
    throw new Error(`Duplicate ${category} file declaration`);
  }
  const output = {};
  if (declaredFiles.length === 0) return output;

  const categoryDirectory = path.join(directory, category);
  const categoryStat = await fs.lstat(categoryDirectory);
  if (!categoryStat.isDirectory() || categoryStat.isSymbolicLink()) {
    throw new Error(`Mod ${category}/ directory is missing or linked`);
  }

  for (const file of declaredFiles) {
    const filePath = path.join(categoryDirectory, file);
    const stat = await fs.lstat(filePath);
    const isIni = file.endsWith(".ini");
    const maxBytes = isIni ? MAX_INI_BYTES : MAX_MOD_JSON_BYTES;
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
      throw new Error(`${category} file is missing, linked or too large: ${file}`);
    }
    const source = await fs.readFile(filePath, "utf8");
    output[file] = isIni ? parseIni(source) : JSON.parse(source);
  }
  return output;
}

async function readModPackages(root) {
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  const mods = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeModId(entry.name)) continue;
    const directory = path.join(root, entry.name);
    try {
      const manifestPath = path.join(directory, "manifest.json");
      const manifestStat = await fs.lstat(manifestPath);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > MAX_MANIFEST_BYTES) {
        throw new Error("Manifest is missing, linked or too large");
      }

      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      const declarations = {};
      for (const category of CATEGORIES) declarations[category] = manifest?.[category + "Files"] ?? [];
      if (
        !manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
        manifest.id !== entry.name || typeof manifest.name !== "string" ||
        typeof manifest.version !== "string" || typeof manifest.author !== "string" ||
        manifest.apiVersion !== MOD_API_VERSION ||
        CATEGORIES.some((category) => !Array.isArray(declarations[category])) ||
        Object.keys(manifest).some((key) => ["code", "codeFiles", "scripts", "scriptFiles"].includes(key))
      ) {
        throw new Error("Invalid manifest or unsupported data-only Mod API version");
      }

      const data = {};
      for (const category of CATEGORIES) {
        data[category] = await readCategory(directory, category, declarations[category]);
      }

      mods.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        author: manifest.author,
        description: typeof manifest.description === "string" ? manifest.description : "",
        apiVersion: manifest.apiVersion,
        data
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

async function loadCoreContent(root) {
  const mods = await readModPackages(root);
  const core = mods.find((mod) => mod.id === "core");
  if (!core) return { ok: false, error: "Required content package mods/core is missing", mods };
  if (core.error) return { ok: false, error: `Core content package is invalid: ${core.error}`, mods };
  return { ok: true, core, mods };
}

module.exports = {
  MOD_API_VERSION, MAX_MANIFEST_BYTES, MAX_MOD_JSON_BYTES, MAX_INI_BYTES,
  CATEGORIES, isSafeModId, isSafeModFile, readModPackages, loadCoreContent
};
