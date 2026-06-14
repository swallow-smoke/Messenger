import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const router: Router = express.Router();

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(80),
  position: z.number().int().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  position: z.number().int().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.query as { workspaceId: string };
    const categories = await prisma.channelCategory.findMany({
      where: { workspaceId },
      orderBy: { position: 'asc' },
    });
    res.json(categories);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, name, position } = req.body as z.infer<typeof createSchema>;
    const category = await prisma.channelCategory.create({
      data: { workspaceId, name, position: position ?? 0 },
    });
    res.status(201).json(category);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id', requireAuth, validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const category = await prisma.channelCategory.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(category);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.channelCategory.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
