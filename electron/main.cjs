const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { readModPackages, loadCoreContent } = require("./mod-loader.cjs");
const {
  initializeStorage, readSettings, writeSettings, listSaveSlots,
  createSaveSlot, readGameState, writeGameState, removeSaveSlot, isSafeSlotId
} = require("./storage.cjs");
const { compileCatalog } = require("../engine/catalog.cjs");
const { createWorld, advanceDay, createSnapshot, validateWorldState } = require("../engine/simulation.cjs");
const { getLogger } = require("./logger.cjs");

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const GAME_ROOT = app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, "..");
const logger = getLogger(GAME_ROOT);
let coreContentPromise;
let storageReady = false;
let quitting = false;
let activeWorld = null;
let activeCatalog = null;
let activeSaveId = null;
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

function handleIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    logger.debug("ipc", `invoke ${channel}`);
    try {
      return await handler(event, ...args);
    } catch (error) {
      logger.error(`ipc.${channel}`, error);
      throw error;
    }
  });
}

handleIpc("mods:list", async () => {
  await ensureStorage();
  const settings = await readSettings(GAME_ROOT);
  const mods = await readModPackages(getModsDirectory(), { enabledMods: settings.mods.enabled });
  return mods.map(({ data, ...metadata }) => metadata);
});
handleIpc("mods:load-all", async () => {
  await ensureStorage();
  const settings = await readSettings(GAME_ROOT);
  return readModPackages(getModsDirectory(), { enabledMods: settings.mods.enabled });
});

function getCoreContent() {
  if (!coreContentPromise) {
    coreContentPromise = (async () => {
      await ensureStorage();
      const settings = await readSettings(GAME_ROOT);
      return loadCoreContent(getModsDirectory(), { enabledMods: settings.mods.enabled });
    })().then((result) => {
      if (!result.ok) logger.error("mods.core", result.error);
      else logger.info("mods.core", "Core data package loaded");
      return result;
    });
  }
  return coreContentPromise;
}
handleIpc("content:load-core", async () => getCoreContent());

async function loadWorldCatalog() {
  await ensureStorage();
  const settings = await readSettings(GAME_ROOT);
  const mods = await readModPackages(getModsDirectory(), { enabledMods: settings.mods.enabled });
  const result = compileCatalog(mods);
  if (!result.ok) throw new Error(`World content validation failed: ${result.error}`);
  return result.catalog;
}

function getActiveWorldSnapshot() {
  if (!activeWorld || !activeCatalog) throw new Error("No active world is loaded");
  return { ...createSnapshot(activeWorld, activeCatalog), saveId: activeSaveId };
}

handleIpc("world:start-new", async () => {
  activeCatalog = await loadWorldCatalog();
  activeWorld = createWorld(activeCatalog, { seed: Date.now() });
  activeSaveId = `slot_demo_${Date.now().toString(36)}`;
  await createSaveSlot(GAME_ROOT, activeSaveId, activeWorld.metadata.name);
  await writeGameState(GAME_ROOT, activeSaveId, activeWorld);
  logger.info("world", `Started world ${activeWorld.universeId} in ${activeSaveId}`);
  return getActiveWorldSnapshot();
});

handleIpc("world:load-save", async (_event, saveId) => {
  if (!isSafeSlotId(saveId)) throw new Error("Invalid save slot ID");
  activeCatalog = await loadWorldCatalog();
  activeWorld = await readGameState(GAME_ROOT, saveId);
  validateWorldState(activeWorld, activeCatalog);
  activeSaveId = saveId;
  logger.info("world", `Loaded world from ${saveId}`);
  return getActiveWorldSnapshot();
});

handleIpc("world:advance-day", async () => {
  if (!activeWorld || !activeCatalog) throw new Error("No active world is loaded");
  advanceDay(activeWorld, activeCatalog);
  logger.info("world", `Advanced to day ${activeWorld.clock.day} (${activeWorld.clock.date})`);
  return getActiveWorldSnapshot();
});

handleIpc("world:save", async () => {
  if (!activeWorld || !activeSaveId) throw new Error("No active world is loaded");
  await writeGameState(GAME_ROOT, activeSaveId, activeWorld);
  logger.info("world", `Saved world to ${activeSaveId}`);
  return { saveId: activeSaveId, savedAt: new Date().toISOString() };
});

handleIpc("world:leave", async () => {
  logger.info("world", `Leaving active world ${activeSaveId || "unknown"}`);
  activeWorld = null;
  activeCatalog = null;
  activeSaveId = null;
  return true;
});

handleIpc("app:quit", async () => {
  logger.info("shutdown", "Quit requested from title menu");
  app.quit();
  return true;
});

handleIpc("settings:read", async () => {
  await ensureStorage();
  return readSettings(GAME_ROOT);
});
handleIpc("settings:write", async (_event, patch) => {
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

handleIpc("save:list-slots", async () => {
  await ensureStorage();
  return listSaveSlots(GAME_ROOT);
});
handleIpc("save:create-slot", async (_event, id, name) => {
  await ensureStorage();
  const slot = await createSaveSlot(GAME_ROOT, id, name);
  logger.info("save", `Created save slot ${id}`);
  return slot;
});
handleIpc("save:remove-slot", async (_event, id) => {
  await ensureStorage();
  await removeSaveSlot(GAME_ROOT, id);
  logger.info("save", `Removed save slot ${id}`);
  return true;
});

// Transitional JSON save methods remain rooted in ./save, never Electron userData.
handleIpc("save:read", async (_event, key) => {
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
handleIpc("save:write", async (_event, key, value) => {
  if (!isSafeSaveKey(key)) throw new Error("Invalid save key");
  await ensureStorage();
  const file = path.join(GAME_ROOT, "save", key + ".json");
  const temporary = file + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(temporary, file);
  logger.info("save", `Wrote legacy save ${key}`);
  return true;
});
handleIpc("save:remove", async (_event, key) => {
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
    frame: true,
    backgroundColor: "#101722",
    title: "FRONTIER — 赫利俄斯边境",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.setMenuBarVisibility(false);
  if (fullscreen) window.setFullScreen(true);
  window.webContents.setZoomFactor((settings?.graphics?.ui_scale || 100) / 100);
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logger.error("renderer.load", { errorCode, errorDescription, validatedURL });
  });
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
  window.on("close", () => logger.info("window", "Main window close requested"));
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
    dialog.showErrorBox("无法初始化游戏目录", `${error.message}\n\n请确认游戏文件夹没有被设为只读，并且当前用户拥有写入权限。`);
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
app.on("child-process-gone", (_event, details) => {
  logger.error("process.child-gone", details);
});
app.on("will-quit", () => logger.info("shutdown", "Application will quit"));
app.on("window-all-closed", () => {
  logger.info("window", "All windows closed");
  if (process.platform !== "darwin") app.quit();
});
