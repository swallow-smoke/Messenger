import express, { type Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router: Router = express.Router();

// Search users by displayName or email (scoped to workspace if workspaceId provided)
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { q, workspaceId } = req.query as { q?: string; workspaceId?: string };
    if (!q || q.length < 1) { res.json([]); return; }

    if (workspaceId) {
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          user: {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, email: true, status: true } },
        },
        take: 20,
      });
      res.json(members.map((m) => ({ ...m.user, role: m.role })));
    } else {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, displayName: true, avatarUrl: true, email: true, status: true },
        take: 20,
      });
      res.json(users);
    }
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get bookmarks for current user
router.get('/me/bookmarks', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user!.id },
      include: {
        message: {
          include: {
            sender: { select: { id: true, displayName: true, avatarUrl: true } },
            attachments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(bookmarks.map((b) => ({ ...b.message, bookmarkedAt: b.createdAt })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
