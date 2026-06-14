import express, { type Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { fetchLinkPreview } from '../services/link-preview';
import { requireAuth } from '../middleware/auth';

const router: Router = express.Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.query as { url: string };
    if (!url) { res.status(400).json({ error: 'url required' }); return; }

    const existing = await prisma.linkPreview.findUnique({ where: { url } });
    if (existing && existing.expiresAt > new Date()) {
      res.json(existing);
      return;
    }

    const preview = await fetchLinkPreview(url);
    const dbFields = {
      title: preview.title,
      description: preview.description,
      imageUrl: preview.imageUrl,
      siteName: preview.siteName,
      embedUrl: preview.embedUrl,
    };
    const saved = await prisma.linkPreview.upsert({
      where: { url },
      create: { url, ...dbFields },
      update: { ...dbFields, fetchedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    res.json({ ...saved, type: preview.type, stars: preview.stars, language: preview.language });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
