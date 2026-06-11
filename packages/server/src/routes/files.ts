import express, { type Router, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { uploadBuffer } from '../lib/minio';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router: Router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const GAME_ASSET_EXTS = new Set(['.glb', '.gltf', '.fbx']);

router.post('/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file' }); return; }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const id = crypto.randomUUID();
    const objectName = `${id}${ext}`;

    const fileUrl = await uploadBuffer(objectName, req.file.buffer, req.file.mimetype);

    let thumbnailUrl: string | null = null;

    if (IMAGE_TYPES.has(req.file.mimetype)) {
      const thumb = await sharp(req.file.buffer)
        .resize(400, 400, { fit: 'cover' })
        .png()
        .toBuffer();
      const thumbName = `${id}_thumb.png`;
      thumbnailUrl = await uploadBuffer(thumbName, thumb, 'image/png');
    } else if (GAME_ASSET_EXTS.has(ext)) {
      thumbnailUrl = null;
    }

    res.json({
      url: fileUrl,
      thumbnailUrl,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });
  } catch {
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
