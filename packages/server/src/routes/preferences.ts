import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router: Router = express.Router();

const updateSchema = z.object({
  enableCodeHighlight: z.boolean().optional(),
  enable3DPreview: z.boolean().optional(),
  keywords: z.array(z.string().max(100)).max(50).optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id },
      update: {},
    });
    res.json(prefs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/', requireAuth, validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body as z.infer<typeof updateSchema>;
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...data },
      update: data,
    });
    res.json(prefs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
