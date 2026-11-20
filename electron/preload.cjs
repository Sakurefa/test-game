const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gameHost", {
  platform: process.platform,
  app: { quit: () => ipcRenderer.invoke("app:quit") },
  mods: {
    list: () => ipcRenderer.invoke("mods:list"),
    loadAll: () => ipcRenderer.invoke("mods:load-all")
  },
  content: {
    loadCore: () => ipcRenderer.invoke("content:load-core")
  },
  world: {
    startNew: () => ipcRenderer.invoke("world:start-new"),
    loadSave: (saveId) => ipcRenderer.invoke("world:load-save", saveId),
    advanceDay: () => ipcRenderer.invoke("world:advance-day"),
    setSpeed: (speed) => ipcRenderer.invoke("world:set-speed", speed),
    getStatus: () => ipcRenderer.invoke("world:time-status"),
    save: () => ipcRenderer.invoke("world:save"),
    leave: () => ipcRenderer.invoke("world:leave")
  },
  settings: {
    read: () => ipcRenderer.invoke("settings:read"),
    write: (patch) => ipcRenderer.invoke("settings:write", patch)
  },
  save: {
    listSlots: () => ipcRenderer.invoke("save:list-slots"),
    createSlot: (id, name) => ipcRenderer.invoke("save:create-slot", id, name),
    removeSlot: (id) => ipcRenderer.invoke("save:remove-slot", id),
    read: (key) => ipcRenderer.invoke("save:read", key),
    write: (key, value) => ipcRenderer.invoke("save:write", key, value),
    remove: (key) => ipcRenderer.invoke("save:remove", key)
  }
});
