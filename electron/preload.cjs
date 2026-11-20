const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gameHost", {
  platform: process.platform,
  mods: {
    list: () => ipcRenderer.invoke("mods:list"),
    loadAll: () => ipcRenderer.invoke("mods:load-all")
  },
  save: {
    read: (key) => ipcRenderer.invoke("save:read", key),
    write: (key, value) => ipcRenderer.invoke("save:write", key, value),
    remove: (key) => ipcRenderer.invoke("save:remove", key)
  }
});
