import { BrowserWindow, ipcMain } from 'electron';

export function registerWindowHandlers(win: BrowserWindow): void {
  // Window-specific handlers that need access to the BrowserWindow instance
  ipcMain.handle('window:isMaximized', () => win.isMaximized());
  ipcMain.handle('window:minimize', () => win.minimize());
  ipcMain.handle('window:maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
}
