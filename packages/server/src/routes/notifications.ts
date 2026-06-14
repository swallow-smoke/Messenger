import express, { type Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import type { Prisma } from '@prisma/client';

const router: Router = express.Router();

const VALID_TYPES = ['mention', 'reply', 'dm', 'keyword'] as const;
type NotifType = typeof VALID_TYPES[number];

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query as { type?: string };
    const typeFilter: Partial<Prisma.NotificationWhereInput> =
      type && VALID_TYPES.includes(type as NotifType)
        ? { type: type as NotifType }
        : {};
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id, ...typeFilter },
      include: {
        message: {
          select: {
            id: true,
            content: true,
            contextId: true,
            contextType: true,
            createdAt: true,
            sender: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id, userId: req.user!.id },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
