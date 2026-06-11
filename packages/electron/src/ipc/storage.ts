import { ipcMain, safeStorage } from 'electron';
import Store from 'electron-store';

const store = new Store<Record<string, string>>();

export function registerStorageHandlers(): void {
  ipcMain.handle('storage:set', (_e, key: string, value: string) => {
    const encrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(value).toString('base64')
      : value;
    store.set(key, encrypted);
    return true;
  });

  ipcMain.handle('storage:get', (_e, key: string) => {
    const raw = store.get(key);
    if (!raw) return null;
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(raw, 'base64'));
      } catch {
        return raw;
      }
    }
    return raw;
  });

  ipcMain.handle('storage:delete', (_e, key: string) => {
    store.delete(key);
    return true;
  });
}
