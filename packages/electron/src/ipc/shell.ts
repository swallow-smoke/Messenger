import { ipcMain, shell } from 'electron';

export function registerShellHandlers(): void {
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      void shell.openExternal(url);
    }
  });
}
