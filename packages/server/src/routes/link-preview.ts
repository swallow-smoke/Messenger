import express, { type Router, Request, Response } from 'express';
import { getCachedLinkPreview } from '../services/link-preview';
import { requireAuth } from '../middleware/auth';

const router: Router = express.Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.query as { url: string };
    if (!url) { res.status(400).json({ error: 'url required' }); return; }

    const preview = await getCachedLinkPreview(url);
    res.json(preview);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
