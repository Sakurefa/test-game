const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const SAVE_DIR = () => path.join(app.getPath("userData"), "saves");
const MOD_API_VERSION = 1;
const MAX_MOD_JSON_BYTES = 2 * 1024 * 1024;

function getModsDirectory() {
  return app.isPackaged
    ? path.join(path.dirname(process.execPath), "mods")
    : path.join(__dirname, "..", "mods");
}

function isSafeSaveKey(key) {
  return typeof key === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(key);
}

function isSafeModId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9._-]{1,63}$/.test(id);
}

function isSafeDataFile(file) {
  return typeof file === "string" && /^[a-zA-Z0-9_-]{1,64}\.json$/.test(file);
}

async function readModPackages() {
  const root = getModsDirectory();
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  const mods = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeModId(entry.name)) continue;

    const directory = path.join(root, entry.name);
    try {
      const manifestPath = path.join(directory, "manifest.json");
      const manifestStat = await fs.stat(manifestPath);
      if (!manifestStat.isFile() || manifestStat.size > 64 * 1024) {
        throw new Error("Manifest is missing or too large");
      }

      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      if (
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

      const uniqueFiles = [...new Set(manifest.dataFiles)];
      const data = {};
      for (const file of uniqueFiles) {
        const filePath = path.join(directory, "data", file);
        const stat = await fs.stat(filePath);
        if (!stat.isFile() || stat.size > MAX_MOD_JSON_BYTES) {
          throw new Error(`Data file is missing or too large: ${file}`);
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

ipcMain.handle("mods:list", async () => {
  const mods = await readModPackages();
  return mods.map(({ data, ...metadata }) => metadata);
});

ipcMain.handle("mods:load-all", async () => readModPackages());

ipcMain.handle("save:read", async (_event, key) => {
  if (!isSafeSaveKey(key)) throw new Error("Invalid save key");
  const file = path.join(SAVE_DIR(), key + ".json");
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
});

ipcMain.handle("save:write", async (_event, key, value) => {
  if (!isSafeSaveKey(key)) throw new Error("Invalid save key");
  const directory = SAVE_DIR();
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, key + ".json");
  const temporaryFile = file + ".tmp";
  const serialized = JSON.stringify(value, null, 2);
  await fs.writeFile(temporaryFile, serialized, "utf8");
  await fs.rename(temporaryFile, file);
  return true;
});

ipcMain.handle("save:remove", async (_event, key) => {
  if (!isSafeSaveKey(key)) throw new Error("Invalid save key");
  const file = path.join(SAVE_DIR(), key + ".json");
  try {
    await fs.unlink(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#101722",
    title: "Market — 随机证券市场",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV_URL) {
    window.loadURL(DEV_URL);
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
