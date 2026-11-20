const fs = require("node:fs/promises");
const path = require("node:path");

const MOD_API_VERSION = 1;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_MOD_JSON_BYTES = 2 * 1024 * 1024;

function isSafeModId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9._-]{1,63}$/.test(id);
}

function isSafeDataFile(file) {
  return typeof file === "string" && /^[a-zA-Z0-9_-]{1,64}\.json$/.test(file);
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
      if (
        !manifest ||
        typeof manifest !== "object" ||
        Array.isArray(manifest) ||
        manifest.id !== entry.name ||
        typeof manifest.name !== "string" ||
        typeof manifest.version !== "string" ||
        typeof manifest.author !== "string" ||
        manifest.apiVersion !== MOD_API_VERSION ||
        !Array.isArray(manifest.dataFiles) ||
        manifest.dataFiles.some((file) => !isSafeDataFile(file))
      ) {
        throw new Error("Invalid manifest or unsupported Mod API version");
      }

      const dataDirectory = path.join(directory, "data");
      const dataDirectoryStat = await fs.lstat(dataDirectory);
      if (!dataDirectoryStat.isDirectory() || dataDirectoryStat.isSymbolicLink()) {
        throw new Error("Mod data directory is missing or linked");
      }

      const uniqueFiles = [...new Set(manifest.dataFiles)];
      const data = {};
      for (const file of uniqueFiles) {
        const filePath = path.join(dataDirectory, file);
        const stat = await fs.lstat(filePath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MOD_JSON_BYTES) {
          throw new Error(`Data file is missing, linked or too large: ${file}`);
        }
        data[file] = JSON.parse(await fs.readFile(filePath, "utf8"));
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

module.exports = {
  MOD_API_VERSION,
  MAX_MANIFEST_BYTES,
  MAX_MOD_JSON_BYTES,
  isSafeModId,
  isSafeDataFile,
  readModPackages
};
