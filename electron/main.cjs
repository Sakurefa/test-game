const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { readModPackages, loadCoreContent } = require("./mod-loader.cjs");
const {
  initializeStorage, readSettings, writeSettings, listSaveSlots,
  createSaveSlot, removeSaveSlot
} = require("./storage.cjs");
const { getLogger } = require("./logger.cjs");

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const GAME_ROOT = app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, "..");
const logger = getLogger(GAME_ROOT);
let coreContentPromise;
let storageReady = false;
let quitting = false;
const cleanupTasks = new Set();

function getModsDirectory() {
  return path.join(GAME_ROOT, "mods");
}

function isSafeSaveKey(key) {
  return typeof key === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(key);
}

async function ensureStorage() {
  if (!storageReady) {
    await initializeStorage(GAME_ROOT);
    storageReady = true;
    logger.info("storage", "Root setting/, save/ and Logs/ directories are ready");
  }
}

function trackCleanup(task) {
  cleanupTasks.add(task);
  return () => cleanupTasks.delete(task);
}

ipcMain.handle("mods:list", async () => {
  const mods = await readModPackages(getModsDirectory());
  return mods.map(({ data, ...metadata }) => metadata);
});
ipcMain.handle("mods:load-all", async () => readModPackages(getModsDirectory()));

function getCoreContent() {
  if (!coreContentPromise) {
    coreContentPromise = loadCoreContent(getModsDirectory()).then((result) => {
      if (!result.ok) logger.error("mods.core", result.error);
      else logger.info("mods.core", "Core data package loaded");
      return result;
    });
  }
  return coreContentPromise;
}
ipcMain.handle("content:load-core", async () => getCoreContent());

ipcMain.handle("settings:read", async () => {
  await ensureStorage();
  return readSettings(GAME_ROOT);
});
ipcMain.handle("settings:write", async (_event, patch) => {
  await ensureStorage();
  const result = await writeSettings(GAME_ROOT, patch);
  logger.info("settings", `Updated settings groups: ${result.changed.join(", ")}`);
  const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (window && result.settings.graphics) {
    window.webContents.setZoomFactor(result.settings.graphics.ui_scale / 100);
  }
  if (window && result.settings.general) {
    const mode = result.settings.general.window_mode;
    if (mode === "windowed") {
      window.setFullScreen(false);
      window.setMenuBarVisibility(false);
      window.setBounds({ width: 1240, height: 820 });
    } else {
      window.setMenuBarVisibility(false);
      window.setFullScreen(true);
    }
  }
  return result.settings;
});

ipcMain.handle("save:list-slots", async () => {
  await ensureStorage();
  return listSaveSlots(GAME_ROOT);
});
ipcMain.handle("save:create-slot", async (_event, id, name) => {
  await ensureStorage();
  const slot = await createSaveSlot(GAME_ROOT, id, name);
  logger.info("save", `Created save slot ${id}`);
  return slot;
});
ipcMain.handle("save:remove-slot", async (_event, id) => {
  await ensureStorage();
  await removeSaveSlot(GAME_ROOT, id);
  logger.info("save", `Removed save slot ${id}`);
  return true;
});

// Transitional JSON save methods remain rooted in ./save, never Electron userData.
ipcMain.handle("save:read", async (_event, key) => {
  if (!isSafeSaveKey(key)) throw new Error("Invalid save key");
  await ensureStorage();
  try {
    return JSON.parse(await fs.readFile(path.join(GAME_ROOT, "save", key + ".json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    logger.error("save", error);
    throw error;
  }
});
ipcMain.handle("save:write", async (_event, key, value) => {
  if (!isSafeSaveKey(key)) throw new Error("Invalid save key");
  await ensureStorage();
  const file = path.join(GAME_ROOT, "save", key + ".json");
  const temporary = file + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(temporary, file);
  logger.info("save", `Wrote legacy save ${key}`);
  return true;
});
ipcMain.handle("save:remove", async (_event, key) => {
  if (!isSafeSaveKey(key)) throw new Error("Invalid save key");
  await ensureStorage();
  try {
    await fs.unlink(path.join(GAME_ROOT, "save", key + ".json"));
    logger.info("save", `Removed legacy save ${key}`);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
});

function createWindow(settings) {
  const mode = settings?.general?.window_mode || "windowed";
  const fullscreen = mode !== "windowed";
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    frame: !fullscreen,
    backgroundColor: "#101722",
    title: "Market — 随机证券市场",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (fullscreen) window.setFullScreen(true);
  window.webContents.setZoomFactor((settings?.graphics?.ui_scale || 100) / 100);
  window.webContents.on("render-process-gone", (_event, details) => {
    logger.error("renderer", `Renderer process exited: ${JSON.stringify(details)}`);
  });
  window.webContents.on("console-message", (_event, details) => {
    const level = details.level >= 3 ? "ERROR" : details.level === 2 ? "WARN" : "DEBUG";
    logger[level.toLowerCase()]("renderer.console", details.message);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    else logger.warn("security", `Blocked external window URL: ${url}`);
    return { action: "deny" };
  });
  window.on("unresponsive", () => logger.error("window", "Renderer became unresponsive"));
  window.on("responsive", () => logger.info("window", "Renderer became responsive"));
  window.on("closed", () => logger.info("window", "Main window closed"));

  if (DEV_URL) window.loadURL(DEV_URL);
  else window.loadFile(path.join(GAME_ROOT, "dist", "index.html"));
  return window;
}

app.whenReady().then(async () => {
  try {
    logger.info("startup", `Application ready; platform=${process.platform}; electron=${process.versions.electron}; node=${process.versions.node}`);
    await ensureStorage();
    const settings = await readSettings(GAME_ROOT);
    const core = await getCoreContent();
    if (!core.ok) logger.error("startup", "Core content is unavailable; title screen will still open");
    createWindow(settings);
    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(await readSettings(GAME_ROOT));
    });
  } catch (error) {
    logger.error("startup", error);
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (quitting) return;
  quitting = true;
  logger.info("shutdown", "Shutdown requested; stopping tracked cleanup tasks");
  if (cleanupTasks.size > 0) {
    event.preventDefault();
    Promise.allSettled([...cleanupTasks]).finally(() => app.quit());
  }
});
app.on("render-process-gone", (_event, _webContents, details) => {
  logger.error("renderer", details);
});
app.on("window-all-closed", () => {
  logger.info("window", "All windows closed");
  if (process.platform !== "darwin") app.quit();
});
