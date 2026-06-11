export interface FileNode {
  name: string;
  path: string;
  children?: FileNode[];
}

export interface FileChangedEvent {
  path: string;
  event: 'change' | 'add' | 'unlink';
}

export interface ElectronAPI {
  obsidian: {
    readFile(filePath: string, vaultPath: string): Promise<string>;
    writeFile(filePath: string, content: string, vaultPath: string): Promise<boolean>;
    listFiles(vaultPath: string): Promise<FileNode[]>;
    startWatch(vaultPath: string): Promise<boolean>;
    stopWatch(): Promise<boolean>;
    onChanged(cb: (data: FileChangedEvent) => void): void;
  };
  storage: {
    set(key: string, value: string): Promise<boolean>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<boolean>;
  };
  notify: {
    show(title: string, body: string, icon?: string): Promise<boolean>;
  };
  asset: {
    getThumbnail(filePath: string): Promise<string | null>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
  window: {
    setBadgeCount(count: number): Promise<void>;
    show(): Promise<void>;
    isMaximized(): Promise<boolean>;
    minimize(): Promise<void>;
    maximize(): Promise<void>;
  };
  app: {
    getVersion(): Promise<string>;
    setAutoLaunch(enable: boolean): Promise<void>;
  };
  updater: {
    install(): Promise<void>;
    onUpdateAvailable(cb: () => void): void;
    onUpdateDownloaded(cb: () => void): void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
