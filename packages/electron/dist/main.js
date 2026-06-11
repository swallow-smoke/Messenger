"use strict";
const electron = require("electron");
const path = require("path");
const Store = require("electron-store");
const electronUpdater = require("electron-updater");
const fs = require("fs/promises");
const chokidar = require("chokidar");
const sharp = require("sharp");
let watcher = null;
function assertSafe(filePath, vaultPath) {
  const resolved = path.resolve(filePath);
  const vaultResolved = path.resolve(vaultPath);
  if (!resolved.startsWith(vaultResolved + path.sep) && resolved !== vaultResolved) {
    throw new Error("Path traversal denied");
  }
}
async function buildTree(dir, vaultPath) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const children = await buildTree(fullPath);
      nodes.push({ name: entry.name, path: fullPath, children });
    } else if (entry.name.endsWith(".md")) {
      nodes.push({ name: entry.name, path: fullPath });
    }
  }
  return nodes;
}
function registerObsidianHandlers(win) {
  electron.ipcMain.handle("obsidian:readFile", async (_e, filePath, vaultPath) => {
    assertSafe(filePath, vaultPath);
    return fs.readFile(filePath, "utf-8");
  });
  electron.ipcMain.handle("obsidian:writeFile", async (_e, filePath, content, vaultPath) => {
    assertSafe(filePath, vaultPath);
    await fs.writeFile(filePath, content, "utf-8");
    return true;
  });
  electron.ipcMain.handle("obsidian:listFiles", async (_e, vaultPath) => {
    return buildTree(vaultPath);
  });
  electron.ipcMain.handle("obsidian:startWatch", async (_e, vaultPath) => {
    if (watcher) await watcher.close();
    watcher = chokidar.watch(vaultPath, { ignored: /(^|[/\\])\../, persistent: true });
    watcher.on("change", (fp) => win.webContents.send("obsidian:file-changed", { path: fp, event: "change" }));
    watcher.on("add", (fp) => win.webContents.send("obsidian:file-changed", { path: fp, event: "add" }));
    watcher.on("unlink", (fp) => win.webContents.send("obsidian:file-changed", { path: fp, event: "unlink" }));
    return true;
  });
  electron.ipcMain.handle("obsidian:stopWatch", async () => {
    if (watcher) {
      await watcher.close();
      watcher = null;
    }
    return true;
  });
}
const store$1 = new Store();
function registerStorageHandlers() {
  electron.ipcMain.handle("storage:set", (_e, key, value) => {
    const encrypted = electron.safeStorage.isEncryptionAvailable() ? electron.safeStorage.encryptString(value).toString("base64") : value;
    store$1.set(key, encrypted);
    return true;
  });
  electron.ipcMain.handle("storage:get", (_e, key) => {
    const raw = store$1.get(key);
    if (!raw) return null;
    if (electron.safeStorage.isEncryptionAvailable()) {
      try {
        return electron.safeStorage.decryptString(Buffer.from(raw, "base64"));
      } catch {
        return raw;
      }
    }
    return raw;
  });
  electron.ipcMain.handle("storage:delete", (_e, key) => {
    store$1.delete(key);
    return true;
  });
}
function registerNotifyHandlers() {
  electron.ipcMain.handle("notify:show", (_e, title, body, icon) => {
    new electron.Notification({ title, body, ...icon ? { icon } : {} }).show();
    return true;
  });
}
const IMAGE_EXTS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".webp"]);
const GAME_EXTS = /* @__PURE__ */ new Set([".glb", ".gltf", ".fbx"]);
function registerAssetHandlers() {
  electron.ipcMain.handle("asset:getThumbnail", async (_e, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (IMAGE_EXTS.has(ext)) {
      const buffer = await sharp(filePath).resize(400, 400, { fit: "cover" }).png().toBuffer();
      return `data:image/png;base64,${buffer.toString("base64")}`;
    }
    if (GAME_EXTS.has(ext)) return null;
    return null;
  });
}
function registerShellHandlers() {
  electron.ipcMain.handle("shell:openExternal", (_e, url) => {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      void electron.shell.openExternal(url);
    }
  });
}
function registerWindowHandlers(win) {
  electron.ipcMain.handle("window:isMaximized", () => win.isMaximized());
  electron.ipcMain.handle("window:minimize", () => win.minimize());
  electron.ipcMain.handle("window:maximize", () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
}
const config = {
  isDev: process.env.NODE_ENV !== "production",
  apiUrl: process.env.VITE_API_URL ?? "http://localhost:4000/api/v1",
  devServerUrl: "http://localhost:5173",
  mainWindowOptions: {
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600
  },
  csp: `default-src 'self' http://localhost:4000 http://localhost:9000 ws://localhost:4000 'unsafe-inline' 'unsafe-eval'`
};
const store = new Store();
let mainWindow = null;
let tray = null;
let isQuitting = false;
function createTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = 74;
    buf[i * 4 + 1] = 158;
    buf[i * 4 + 2] = 255;
    buf[i * 4 + 3] = 255;
  }
  return electron.nativeImage.createFromBuffer(buf, { width: size, height: size });
}
function createTray(win) {
  const icon = createTrayIcon();
  tray = new electron.Tray(icon);
  tray.setToolTip("GameDev Messenger");
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        win.show();
        win.focus();
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (win.isVisible()) {
      win.focus();
    } else {
      win.show();
    }
  });
}
function getSavedWindowState() {
  return store.get("windowState") ?? {
    width: config.mainWindowOptions.width,
    height: config.mainWindowOptions.height
  };
}
function saveWindowState(win) {
  if (win.isMaximized() || win.isMinimized()) return;
  const bounds = win.getBounds();
  store.set("windowState", {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  });
}
function createWindow() {
  const savedState = getSavedWindowState();
  const win = new electron.BrowserWindow({
    ...config.mainWindowOptions,
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !config.isDev
    }
  });
  win.once("ready-to-show", () => win.show());
  if (config.isDev) {
    win.loadURL(config.devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/dist/index.html"));
  }
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      saveWindowState(win);
      win.hide();
    }
  });
  win.on("resize", () => saveWindowState(win));
  win.on("move", () => saveWindowState(win));
  registerObsidianHandlers(win);
  registerWindowHandlers(win);
  return win;
}
function setupAutoUpdater(win) {
  electronUpdater.autoUpdater.autoDownload = false;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
  electronUpdater.autoUpdater.on("update-available", () => {
    win.webContents.send("updater:update-available");
  });
  electronUpdater.autoUpdater.on("update-downloaded", () => {
    win.webContents.send("updater:update-downloaded");
  });
  if (!config.isDev) {
    electronUpdater.autoUpdater.checkForUpdates().catch(() => {
    });
  }
}
function setupGlobalShortcuts(win) {
  electron.globalShortcut.register("CommandOrControl+Shift+G", () => {
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
}
function setupAutoLaunch() {
  if (process.platform === "win32" && !config.isDev) {
    const exePath = process.execPath;
    electron.app.getPath("exe");
    electron.app.setLoginItemSettings({
      openAtLogin: false,
      // default off, user can enable via settings
      path: exePath
    });
  }
}
electron.ipcMain.handle("updater:install", () => {
  isQuitting = true;
  electronUpdater.autoUpdater.quitAndInstall();
});
electron.ipcMain.handle("window:setBadgeCount", (_e, count) => {
  electron.app.setBadgeCount(count);
});
electron.ipcMain.handle("window:show", () => {
  mainWindow?.show();
  mainWindow?.focus();
});
electron.ipcMain.handle("app:getVersion", () => electron.app.getVersion());
electron.ipcMain.handle("app:setAutoLaunch", (_e, enable) => {
  if (process.platform === "win32") {
    electron.app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath });
  }
});
electron.app.whenReady().then(() => {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [config.csp]
      }
    });
  });
  electron.Menu.setApplicationMenu(null);
  registerStorageHandlers();
  registerNotifyHandlers();
  registerAssetHandlers();
  registerShellHandlers();
  mainWindow = createWindow();
  createTray(mainWindow);
  setupGlobalShortcuts(mainWindow);
  setupAutoLaunch();
  setupAutoUpdater(mainWindow);
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});
electron.app.on("before-quit", () => {
  isQuitting = true;
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
