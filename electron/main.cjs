const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { readModPackages } = require("./mod-loader.cjs");

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const SAVE_DIR = () => path.join(app.getPath("userData"), "saves");

function getModsDirectory() {
  return app.isPackaged
    ? path.join(path.dirname(process.execPath), "mods")
    : path.join(__dirname, "..", "mods");
}

function isSafeSaveKey(key) {
  return typeof key === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(key);
}


ipcMain.handle("mods:list", async () => {
  const mods = await readModPackages(getModsDirectory());
  return mods.map(({ data, ...metadata }) => metadata);
});

ipcMain.handle("mods:load-all", async () => readModPackages(getModsDirectory()));

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
