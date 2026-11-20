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
  if (!activeWorld) return null;
  try {
    return {
      clock: { ...activeWorld.clock },
      timeControl: campaignTime.getState()
    };
  } catch (error) {
    void failActiveWorld(error, "world.clock-status");
    throw error;
  }
}

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
