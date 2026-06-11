import { ipcMain, Notification } from 'electron';

export function registerNotifyHandlers(): void {
  ipcMain.handle('notify:show', (_e, title: string, body: string, icon?: string) => {
    new Notification({ title, body, ...(icon ? { icon } : {}) }).show();
    return true;
  });
}
