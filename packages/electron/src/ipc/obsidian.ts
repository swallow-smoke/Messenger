import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

let watcher: FSWatcher | null = null;

export interface FileNode {
  name: string;
  path: string;
  children?: FileNode[];
}

function assertSafe(filePath: string, vaultPath: string): void {
  const resolved = path.resolve(filePath);
  const vaultResolved = path.resolve(vaultPath);
  if (!resolved.startsWith(vaultResolved + path.sep) && resolved !== vaultResolved) {
    throw new Error('Path traversal denied');
  }
}

async function buildTree(dir: string, vaultPath: string): Promise<FileNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, vaultPath);
      nodes.push({ name: entry.name, path: fullPath, children });
    } else if (entry.name.endsWith('.md')) {
      nodes.push({ name: entry.name, path: fullPath });
    }
  }
  return nodes;
}

export function registerObsidianHandlers(win: BrowserWindow): void {
  ipcMain.handle('obsidian:readFile', async (_e, filePath: string, vaultPath: string) => {
    assertSafe(filePath, vaultPath);
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('obsidian:writeFile', async (_e, filePath: string, content: string, vaultPath: string) => {
    assertSafe(filePath, vaultPath);
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('obsidian:listFiles', async (_e, vaultPath: string) => {
    return buildTree(vaultPath, vaultPath);
  });

  ipcMain.handle('obsidian:startWatch', async (_e, vaultPath: string) => {
    if (watcher) await watcher.close();
    watcher = chokidar.watch(vaultPath, { ignored: /(^|[/\\])\../, persistent: true });
    watcher.on('change', (fp) => win.webContents.send('obsidian:file-changed', { path: fp, event: 'change' }));
    watcher.on('add', (fp) => win.webContents.send('obsidian:file-changed', { path: fp, event: 'add' }));
    watcher.on('unlink', (fp) => win.webContents.send('obsidian:file-changed', { path: fp, event: 'unlink' }));
    return true;
  });

  ipcMain.handle('obsidian:stopWatch', async () => {
    if (watcher) { await watcher.close(); watcher = null; }
    return true;
  });
}
