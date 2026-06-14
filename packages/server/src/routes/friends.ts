import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import type { Server as SocketServer } from 'socket.io';

const router: Router = express.Router();

const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  status: true,
  statusText: true,
  lastSeenAt: true,
} as const;

// GET / — friendships for the current user
// ?status=all → every status; default → accepted only
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const allStatuses = req.query.status === 'all';

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        ...(allStatuses ? {} : { status: 'accepted' }),
      },
      include: {
        requester: { select: userSelect },
        receiver: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      friendships.map((f) => ({
        id: f.id,
        status: f.status,
        requesterId: f.requesterId,
        receiverId: f.receiverId,
        createdAt: f.createdAt,
        otherUser: f.requesterId === userId ? f.receiver : f.requester,
      }))
    );
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /requests — pending incoming friend requests
router.get('/requests', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.friendship.findMany({
      where: { receiverId: req.user!.id, status: 'pending' },
      include: { requester: { select: { id: true, displayName: true, avatarUrl: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /request — send friend request
router.post(
  '/request',
  requireAuth,
  validate(z.object({ targetUserId: z.string().uuid() })),
  async (req: AuthRequest, res: Response) => {
    try {
      const { targetUserId } = req.body as { targetUserId: string };
      const userId = req.user!.id;

      if (userId === targetUserId) {
        res.status(400).json({ error: '자기 자신에게 친구 요청을 보낼 수 없습니다' });
        return;
      }

      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: userId, receiverId: targetUserId },
            { requesterId: targetUserId, receiverId: userId },
          ],
        },
      });
      if (existing) {
        res.status(409).json({ error: '이미 친구 관계가 존재합니다' });
        return;
      }

      const friendship = await prisma.friendship.create({
        data: { requesterId: userId, receiverId: targetUserId },
        include: {
          requester: { select: { id: true, displayName: true, avatarUrl: true } },
          receiver: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      });

      const io: SocketServer = req.app.get('io');
      io.to(targetUserId).emit('friend:request-received', {
        id: friendship.id,
        requesterId: friendship.requesterId,
        receiverId: friendship.receiverId,
        createdAt: friendship.createdAt,
        requester: friendship.requester,
      });

      res.status(201).json(friendship);
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /:id/accept
router.post('/:id/accept', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const friendship = await prisma.friendship.findUniqueOrThrow({ where: { id: req.params.id } });
    if (friendship.receiverId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const updated = await prisma.friendship.update({
      where: { id: req.params.id },
      data: { status: 'accepted' },
      include: { receiver: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    const io: SocketServer = req.app.get('io');
    io.to(friendship.requesterId).emit('friend:request-accepted', {
      id: updated.id,
      accepter: updated.receiver,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/reject
router.post('/:id/reject', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const friendship = await prisma.friendship.findUniqueOrThrow({ where: { id: req.params.id } });
    if (friendship.receiverId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await prisma.friendship.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /:id — remove friend or cancel outgoing request
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const friendship = await prisma.friendship.findUniqueOrThrow({ where: { id: req.params.id } });
    const userId = req.user!.id;
    if (friendship.requesterId !== userId && friendship.receiverId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await prisma.friendship.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/block
router.post('/:id/block', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const friendship = await prisma.friendship.findUniqueOrThrow({ where: { id: req.params.id } });
    const userId = req.user!.id;
    if (friendship.requesterId !== userId && friendship.receiverId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const updated = await prisma.friendship.update({
      where: { id: req.params.id },
      data: { status: 'blocked' },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
