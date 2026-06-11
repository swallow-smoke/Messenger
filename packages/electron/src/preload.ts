import { contextBridge, ipcRenderer } from 'electron';
import type { FileNode } from './ipc/obsidian';

contextBridge.exposeInMainWorld('electron', {
  obsidian: {
    readFile: (filePath: string, vaultPath: string) =>
      ipcRenderer.invoke('obsidian:readFile', filePath, vaultPath),
    writeFile: (filePath: string, content: string, vaultPath: string) =>
      ipcRenderer.invoke('obsidian:writeFile', filePath, content, vaultPath),
    listFiles: (vaultPath: string): Promise<FileNode[]> =>
      ipcRenderer.invoke('obsidian:listFiles', vaultPath),
    startWatch: (vaultPath: string) =>
      ipcRenderer.invoke('obsidian:startWatch', vaultPath),
    stopWatch: () => ipcRenderer.invoke('obsidian:stopWatch'),
    onChanged: (cb: (data: { path: string; event: string }) => void) => {
      ipcRenderer.on('obsidian:file-changed', (_e, data) => cb(data));
    },
  },
  storage: {
    set: (key: string, value: string) => ipcRenderer.invoke('storage:set', key, value),
    get: (key: string) => ipcRenderer.invoke('storage:get', key),
    delete: (key: string) => ipcRenderer.invoke('storage:delete', key),
  },
  notify: {
    show: (title: string, body: string, icon?: string) =>
      ipcRenderer.invoke('notify:show', title, body, icon),
  },
  asset: {
    getThumbnail: (filePath: string) => ipcRenderer.invoke('asset:getThumbnail', filePath),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  window: {
    setBadgeCount: (count: number) => ipcRenderer.invoke('window:setBadgeCount', count),
    show: () => ipcRenderer.invoke('window:show'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    setAutoLaunch: (enable: boolean) => ipcRenderer.invoke('app:setAutoLaunch', enable),
  },
  updater: {
    install: () => ipcRenderer.invoke('updater:install'),
    onUpdateAvailable: (cb: () => void) => {
      ipcRenderer.on('updater:update-available', cb);
    },
    onUpdateDownloaded: (cb: () => void) => {
      ipcRenderer.on('updater:update-downloaded', cb);
    },
  },
});
