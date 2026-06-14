import { app, BrowserWindow, Menu, session, Tray, nativeImage, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { registerObsidianHandlers } from './ipc/obsidian';
import { registerStorageHandlers } from './ipc/storage';
import { registerNotifyHandlers } from './ipc/notify';
import { registerAssetHandlers } from './ipc/asset';
import { registerShellHandlers } from './ipc/shell';
import { registerWindowHandlers } from './ipc/window';
import { config } from './config';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

const store = new Store<{ windowState: WindowState; darkMode: boolean; autoLaunch: boolean }>();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createTrayIcon(): Electron.NativeImage {
  // 16x16 minimal PNG — blue square
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = 0x4a;     // R
    buf[i * 4 + 1] = 0x9e; // G
    buf[i * 4 + 2] = 0xff; // B
    buf[i * 4 + 3] = 0xff; // A
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createTray(win: BrowserWindow): void {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('GameDev Messenger');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        win.show();
        win.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (win.isVisible()) {
      win.focus();
    } else {
      win.show();
    }
  });
}

function getSavedWindowState(): WindowState {
  return (
    (store.get('windowState') as WindowState | undefined) ?? {
      width: config.mainWindowOptions.width,
      height: config.mainWindowOptions.height,
    }
  );
}

function saveWindowState(win: BrowserWindow): void {
  if (win.isMaximized() || win.isMinimized()) return;
  const bounds = win.getBounds();
  store.set('windowState', {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
}

function createWindow(): BrowserWindow {
  const savedState = getSavedWindowState();

  const win = new BrowserWindow({
    ...config.mainWindowOptions,
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !config.isDev,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    if (config.isDev) {
      win.webContents.openDevTools();
    }
  });

  if (config.isDev) {
    win.loadURL(config.devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      saveWindowState(win);
      win.hide();
    }
  });

  win.on('resize', () => saveWindowState(win));
  win.on('move', () => saveWindowState(win));

  registerObsidianHandlers(win);
  registerWindowHandlers(win);

  return win;
}

function setupAutoUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    win.webContents.send('updater:update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('updater:update-downloaded');
  });

  // Check for updates silently on launch (only in production)
  if (!config.isDev) {
    autoUpdater.checkForUpdates().catch(() => {});
  }
}

function setupGlobalShortcuts(win: BrowserWindow): void {
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  globalShortcut.register('F12', () => {
    win.webContents.toggleDevTools();
  });
}

function setupAutoLaunch(): void {
  // Use registry approach on Windows to avoid electron-auto-launch ESM issues
  if (process.platform === 'win32' && !config.isDev) {
    const exePath = process.execPath;
    const Registry = app.getPath('exe');
    // Simple registry-based auto-launch via electron app's built-in
    app.setLoginItemSettings({
      openAtLogin: false, // default off, user can enable via settings
      path: exePath,
    });
  }
}

ipcMain.handle('updater:install', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

ipcMain.handle('window:setBadgeCount', (_e, count: number) => {
  app.setBadgeCount(count);
});

ipcMain.handle('window:show', () => {
  mainWindow?.show();
  mainWindow?.focus();
});

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('app:setAutoLaunch', (_e, enable: boolean) => {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath });
  }
});

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [config.csp],
      },
    });
  });

  Menu.setApplicationMenu(null);
  registerStorageHandlers();
  registerNotifyHandlers();
  registerAssetHandlers();
  registerShellHandlers();

  mainWindow = createWindow();
  createTray(mainWindow);
  setupGlobalShortcuts(mainWindow);
  setupAutoLaunch();
  setupAutoUpdater(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
