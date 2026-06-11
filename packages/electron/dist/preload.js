"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  obsidian: {
    readFile: (filePath, vaultPath) => electron.ipcRenderer.invoke("obsidian:readFile", filePath, vaultPath),
    writeFile: (filePath, content, vaultPath) => electron.ipcRenderer.invoke("obsidian:writeFile", filePath, content, vaultPath),
    listFiles: (vaultPath) => electron.ipcRenderer.invoke("obsidian:listFiles", vaultPath),
    startWatch: (vaultPath) => electron.ipcRenderer.invoke("obsidian:startWatch", vaultPath),
    stopWatch: () => electron.ipcRenderer.invoke("obsidian:stopWatch"),
    onChanged: (cb) => {
      electron.ipcRenderer.on("obsidian:file-changed", (_e, data) => cb(data));
    }
  },
  storage: {
    set: (key, value) => electron.ipcRenderer.invoke("storage:set", key, value),
    get: (key) => electron.ipcRenderer.invoke("storage:get", key),
    delete: (key) => electron.ipcRenderer.invoke("storage:delete", key)
  },
  notify: {
    show: (title, body, icon) => electron.ipcRenderer.invoke("notify:show", title, body, icon)
  },
  asset: {
    getThumbnail: (filePath) => electron.ipcRenderer.invoke("asset:getThumbnail", filePath)
  },
  shell: {
    openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url)
  },
  window: {
    setBadgeCount: (count) => electron.ipcRenderer.invoke("window:setBadgeCount", count),
    show: () => electron.ipcRenderer.invoke("window:show"),
    isMaximized: () => electron.ipcRenderer.invoke("window:isMaximized"),
    minimize: () => electron.ipcRenderer.invoke("window:minimize"),
    maximize: () => electron.ipcRenderer.invoke("window:maximize")
  },
  app: {
    getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
    setAutoLaunch: (enable) => electron.ipcRenderer.invoke("app:setAutoLaunch", enable)
  },
  updater: {
    install: () => electron.ipcRenderer.invoke("updater:install"),
    onUpdateAvailable: (cb) => {
      electron.ipcRenderer.on("updater:update-available", cb);
    },
    onUpdateDownloaded: (cb) => {
      electron.ipcRenderer.on("updater:update-downloaded", cb);
    }
  }
});
