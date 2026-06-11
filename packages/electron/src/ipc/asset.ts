import { ipcMain } from 'electron';
import sharp from 'sharp';
import path from 'path';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const GAME_EXTS = new Set(['.glb', '.gltf', '.fbx']);

export function registerAssetHandlers(): void {
  ipcMain.handle('asset:getThumbnail', async (_e, filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    if (IMAGE_EXTS.has(ext)) {
      const buffer = await sharp(filePath)
        .resize(400, 400, { fit: 'cover' })
        .png()
        .toBuffer();
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
    if (GAME_EXTS.has(ext)) return null;
    return null;
  });
}
