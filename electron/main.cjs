const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { readModPackages, loadCoreContent } = require("./mod-loader.cjs");
const {
  initializeStorage, readSettings, writeSettings, listSaveSlots,
  createSaveSlot, readGameState, writeGameState, removeSaveSlot, isSafeSlotId
} = require("./storage.cjs");
const { createAutomaticSaveManager } = require("./autosave.cjs");
const { compileCatalog } = require("../engine/catalog.cjs");
const { createWorld, advanceDay, advanceCampaignTime, migrateWorldState, createSnapshot, validateWorldState } = require("../engine/simulation.cjs");
const { CampaignTimeController } = require("../engine/campaign-time.cjs");
const { createWorldCommandGateway } = require("./world-command-gateway.cjs");
const { getLogger } = require("./logger.cjs");

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const GAME_ROOT = app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, "..");
const logger = getLogger(GAME_ROOT);
let coreContentPromise;
let storageReady = false;
let quitting = false;
let activeWorld = null;
let activeCatalog = null;
let mainWindow = null;
let pendingFatalReport = null;
let fatalHandling = false;
let activeSaveId = null;
let activeWorldDirty = false;
let activeCommandGateway = null;
let worldSaveInProgress = false;
let worldTransitionInProgress = false;
const cleanupTasks = new Set();
const automaticSaves = createAutomaticSaveManager({
  root: GAME_ROOT, listSaveSlots, createSaveSlot, readGameState, writeGameState
});
function queueAutomaticSave(kind, world) {
  try {
    const task = automaticSaves.save(kind, world).then((result) => {
      logger.info("autosave.complete", result);
    }).catch((error) => {
      logger.error("autosave.failed", { kind, day: world.clock.day, date: world.clock.date, error });
    });
    const untrack = trackCleanup(task);
    task.finally(untrack);
  } catch (error) {
    logger.error("autosave.failed", { kind, day: world.clock.day, date: world.clock.date, error });
  }
}
function onDaySettled(world, detail) {
  logger.info("simulation.day-settled", detail);
  queueAutomaticSave("daily", world);
  if (detail.day % 7 === 0) queueAutomaticSave("weekly", world);
}
async function failActiveWorld(error, source) {
  if (fatalHandling) return;
  fatalHandling = true;
  campaignTime.pause();
  const failureId = require("node:crypto").randomUUID();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : String(error);
  logger.error("world.fatal", { failureId, source, message: errorMessage, stack: errorStack });
  disposeWorldCommandGateway();
  activeWorld = null;
  activeCatalog = null;
  activeSaveId = null;
  activeWorldDirty = false;
  await new Promise((resolve) => setTimeout(resolve, 150));
  let logContext = errorStack || errorMessage;
  try {
    const logFiles = ["runtime.4.log", "runtime.3.log", "runtime.2.log", "runtime.1.log", "runtime.log"];
    const lines = [];
    for (const fileName of logFiles) {
      try {
        const content = await fs.readFile(path.join(logger.directory, fileName), "utf8");
        lines.push(...content.split(/\r?\n/).filter(Boolean));
      } catch (readError) {
        if (readError.code !== "ENOENT") throw readError;
      }
    }
    const index = lines.findIndex((line) => line.includes(failureId));
    if (index >= 0) logContext = lines.slice(Math.max(0, index - 5), index + 6).join("\n");
  } catch (readError) {
    logger.error("world.fatal-log-read", readError);
  }
  pendingFatalReport = { failureId, source, message: errorMessage, stack: errorStack, logContext };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app:world-fatal-error", pendingFatalReport);
    pendingFatalReport = null;
  }
  logger.error("world.fatal", { failureId, status: "returned-to-title-screen" });
}
const campaignTime = new CampaignTimeController({
  baseDayDurationMs: 60000,
  onAdvance: (elapsedGameDays) => {
    if (!activeWorld || !activeCatalog) return;
    const eventBus = activeCommandGateway ? { publish: (event) => activeCommandGateway.publishEvent(event) } : null;
    const result = advanceCampaignTime(activeWorld, activeCatalog, elapsedGameDays, {
      ...(eventBus ? { eventBus } : {}), onDaySettled
    });
    if (result.daysAdvanced > 0 || result.dayFraction !== 0) activeWorldDirty = true;
  }
});
const campaignTimer = setInterval(() => {
  try {
    campaignTime.tick();
  } catch (error) {
    campaignTime.pause();
    void failActiveWorld(error, "campaign-clock");
  }
}, 100);
campaignTimer.unref?.();

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

function disposeWorldCommandGateway() {
  activeCommandGateway?.dispose();
  activeCommandGateway = null;
}

function installWorldCommandGateway() {
  disposeWorldCommandGateway();
  if (!activeWorld || !activeCatalog) return;
  activeCommandGateway = createWorldCommandGateway({
    getWorld: () => activeWorld,
    getCatalog: () => activeCatalog,
    getActor: (world) => ({ type: "player", id: world.player.factionId }),
    onWorldCommit: (world) => {
      activeWorld = world;
      activeWorldDirty = true;
    },
    onEvent: (event) => {
      logger.info("world.domain-event", event);
    }
  });
}

function getActiveWorldSnapshot() {
  if (!activeWorld || !activeCatalog) throw new Error("No active world is loaded");
  try {
    campaignTime.tick();
    return { ...createSnapshot(activeWorld, activeCatalog), saveId: activeSaveId, dirty: activeWorldDirty, timeControl: campaignTime.getState() };
  } catch (error) {
    void failActiveWorld(error, "world.snapshot");
    throw error;
  }
}

function getActiveWorldClockStatus() {
  if (!activeWorld || !activeCatalog) throw new Error("No active world is loaded");
  campaignTime.tick();
  return {
    clock: { ...activeWorld.clock },
    saveId: activeSaveId,
    dirty: activeWorldDirty,
    timeControl: campaignTime.getState()
  };
}

handleIpc("world:start-new", async () => {
  if (worldSaveInProgress || worldTransitionInProgress) throw new Error("A world transition or save is already in progress");
  worldTransitionInProgress = true;
  try {
    const nextCatalog = await loadWorldCatalog();
    const nextWorld = createWorld(nextCatalog, { seed: Date.now() });
    const nextSaveId = `slot_demo_${Date.now().toString(36)}`;
    await createSaveSlot(GAME_ROOT, nextSaveId, nextWorld.metadata.name);
    try {
      await writeGameState(GAME_ROOT, nextSaveId, nextWorld);
    } catch (error) {
      await removeSaveSlot(GAME_ROOT, nextSaveId).catch(() => {});
      throw error;
    }
    campaignTime.tick();
    campaignTime.pause();
    disposeWorldCommandGateway();
    activeCatalog = nextCatalog;
    activeWorld = nextWorld;
    fatalHandling = false;
    pendingFatalReport = null;
    campaignTime.reset();
    activeSaveId = nextSaveId;
    activeWorldDirty = false;
    installWorldCommandGateway();
    logger.info("world", `Started world ${activeWorld.universeId} in ${activeSaveId}`);
    return getActiveWorldSnapshot();
  } finally {
    worldTransitionInProgress = false;
  }
});

handleIpc("world:load-save", async (_event, saveId) => {
  if (!isSafeSlotId(saveId)) throw new Error("Invalid save slot ID");
  if (worldSaveInProgress || worldTransitionInProgress) throw new Error("A world transition or save is already in progress");
  worldTransitionInProgress = true;
  try {
    const nextCatalog = await loadWorldCatalog();
    const nextWorld = migrateWorldState(await readGameState(GAME_ROOT, saveId));
    validateWorldState(nextWorld, nextCatalog);
    campaignTime.tick();
    campaignTime.pause();
    disposeWorldCommandGateway();
    activeCatalog = nextCatalog;
    activeWorld = nextWorld;
    fatalHandling = false;
    pendingFatalReport = null;
    campaignTime.reset();
    activeSaveId = saveId;
    activeWorldDirty = false;
    installWorldCommandGateway();
    logger.info("world", `Loaded world from ${saveId}`);
    return getActiveWorldSnapshot();
  } finally {
    worldTransitionInProgress = false;
  }
});

handleIpc("world:set-speed", async (_event, speed) => {
  if (worldSaveInProgress || worldTransitionInProgress) throw new Error("Time controls are temporarily unavailable during a save or world transition");
  if (!activeWorld || !activeCatalog) throw new Error("No active world is loaded");
  const state = campaignTime.setSpeed(speed);
  logger.info("world.clock", state.paused ? "Campaign time paused" : `Campaign time set to ${state.speed}x`);
  return getActiveWorldSnapshot();
});

handleIpc("world:dispatch-command", async (_event, command) => {
  if (worldSaveInProgress || worldTransitionInProgress) throw new Error("World commands are temporarily unavailable during a save or world transition");
  if (!activeCommandGateway) throw new Error("No active world command gateway is available");
  campaignTime.tick();
  const outcome = activeCommandGateway.dispatch(command);
  return { ...outcome, snapshot: getActiveWorldSnapshot() };
});

handleIpc("world:clock-status", async () => {
  if (worldTransitionInProgress) throw new Error("World status is temporarily unavailable during a world transition");
  return getActiveWorldClockStatus();
});
handleIpc("world:time-status", async () => {
  if (worldTransitionInProgress) throw new Error("World status is temporarily unavailable during a world transition");
  return getActiveWorldSnapshot();
});

handleIpc("world:advance-day", async () => {
  if (worldSaveInProgress || worldTransitionInProgress) throw new Error("World progression is temporarily unavailable during a save or world transition");
  if (!activeWorld || !activeCatalog) throw new Error("No active world is loaded");
  campaignTime.pause();
  const eventBus = activeCommandGateway ? { publish: (event) => activeCommandGateway.publishEvent(event) } : null;
  try {
    advanceDay(activeWorld, activeCatalog, { ...(eventBus ? { eventBus } : {}), onDaySettled });
  } catch (error) {
    void failActiveWorld(error, "manual-day-advance");
    throw error;
  }
  activeWorldDirty = true;
  logger.info("world", `Advanced to day ${activeWorld.clock.day} (${activeWorld.clock.date})`);
  return getActiveWorldSnapshot();
});

handleIpc("world:save", async () => {
  if (!activeWorld || !activeSaveId) throw new Error("No active world is loaded");
  if (worldSaveInProgress || worldTransitionInProgress) throw new Error("A world save or transition is already in progress");
  worldSaveInProgress = true;
  let worldBeingSaved = null;
  let saveId = null;
  let previousSpeed = 0;
  try {
    campaignTime.tick();
    worldBeingSaved = activeWorld;
    saveId = activeSaveId;
    previousSpeed = campaignTime.getState().speed;
    campaignTime.pause();
    const consistentSnapshot = structuredClone(worldBeingSaved);
    await writeGameState(GAME_ROOT, saveId, consistentSnapshot);
    if (activeWorld === worldBeingSaved && activeSaveId === saveId) activeWorldDirty = false;
    logger.info("world", `Saved world to ${saveId}`);
    return { saveId, savedAt: new Date().toISOString() };
  } finally {
    worldSaveInProgress = false;
    if (worldBeingSaved && activeWorld === worldBeingSaved && activeSaveId === saveId && previousSpeed > 0) {
      campaignTime.setSpeed(previousSpeed);
    }
  }
});

handleIpc("world:leave", async () => {
  if (worldSaveInProgress || worldTransitionInProgress) throw new Error("Cannot leave while a world save or transition is in progress");
  campaignTime.pause();
  disposeWorldCommandGateway();
  logger.info("world", `Leaving active world ${activeSaveId || "unknown"}`);
  activeWorld = null;
  activeCatalog = null;
  activeSaveId = null;
  activeWorldDirty = false;
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
  campaignTime.setBaseDayDurationMs(result.settings.simulation.base_day_seconds * 1000);
  logger.info("settings", `Updated settings groups: ${result.changed.join(", ")}`);
  const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (window && result.settings.graphics) {
    window.webContents.setZoomFactor(result.settings.graphics.ui_scale / 100);
  }
  if (window && result.settings.general) {
    const mode = result.settings.general.window_mode;
    if (mode === "windowed") {
      window.setFullScreen(false);
      mainWindow = window;
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
  mainWindow = window;
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
  window.on("closed", () => {
    logger.info("window", "Main window closed");
    if (mainWindow === window) mainWindow = null;
  });
  window.webContents.on("did-finish-load", () => {
    if (pendingFatalReport) {
      window.webContents.send("app:world-fatal-error", pendingFatalReport);
      pendingFatalReport = null;
    }
  });

  if (DEV_URL) window.loadURL(DEV_URL);
  else window.loadFile(path.join(GAME_ROOT, "dist", "index.html"));
  return window;
}

app.whenReady().then(async () => {
  try {
    logger.info("startup", `Application ready; platform=${process.platform}; electron=${process.versions.electron}; node=${process.versions.node}`);
    await ensureStorage();
    const settings = await readSettings(GAME_ROOT);
    campaignTime.setBaseDayDurationMs(settings.simulation.base_day_seconds * 1000);
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
  campaignTime.pause();
  clearInterval(campaignTimer);
  logger.info("shutdown", "Shutdown requested; stopping tracked cleanup tasks");
  if (cleanupTasks.size > 0) {
    event.preventDefault();
    Promise.allSettled([...cleanupTasks]).finally(() => app.quit());
  }
});
app.on("child-process-gone", (_event, details) => {
  logger.error("process.child-gone", details);
});
app.on("will-quit", () => {
  disposeWorldCommandGateway();
  clearInterval(campaignTimer);
  logger.info("shutdown", "Application will quit");
});
app.on("window-all-closed", () => {
  logger.info("window", "All windows closed");
  if (process.platform !== "darwin") app.quit();
});
