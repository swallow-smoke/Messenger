import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router: Router = express.Router();

const updateProfileSchema = z.object({
  profileReadme: z.string().max(2000).nullable().optional(),
});

const connectedAccountSchema = z.object({
  provider: z.enum(['github', 'notion', 'itchio', 'portfolio']),
  url: z.string().url().max(500),
  displayName: z.string().min(1).max(100),
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const statusScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startTime: z.string().regex(HHMM, 'startTime must be HH:MM'),
  endTime: z.string().regex(HHMM, 'endTime must be HH:MM'),
  statusEmoji: z.string().max(8).nullable().optional(),
  statusText: z.string().min(1).max(100),
  isActive: z.boolean().optional(),
});

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

// Update current user's profile (README, markdown, max 2000 chars)
router.patch('/me/profile', requireAuth, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body as z.infer<typeof updateProfileSchema>;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(data.profileReadme !== undefined ? { profileReadme: data.profileReadme } : {}),
      },
      select: { id: true, profileReadme: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// List the current user's auto status schedules
router.get('/me/status-schedule', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const schedules = await prisma.statusSchedule.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(schedules);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create an auto status schedule for the current user
router.post('/me/status-schedule', requireAuth, validate(statusScheduleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body as z.infer<typeof statusScheduleSchema>;
    const schedule = await prisma.statusSchedule.create({
      data: {
        userId: req.user!.id,
        dayOfWeek: data.dayOfWeek ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        statusEmoji: data.statusEmoji ?? null,
        statusText: data.statusText,
        isActive: data.isActive ?? true,
      },
    });
    res.status(201).json(schedule);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an auto status schedule (must belong to the current user)
router.delete('/me/status-schedule/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.statusSchedule.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a connected account for the current user
router.post('/me/connected-accounts', requireAuth, validate(connectedAccountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { provider, url, displayName } = req.body as z.infer<typeof connectedAccountSchema>;
    const account = await prisma.connectedAccount.create({
      data: { userId: req.user!.id, provider, url, displayName },
      select: { id: true, provider: true, url: true, displayName: true, createdAt: true },
    });
    res.status(201).json(account);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove a connected account (must belong to the current user)
router.delete('/me/connected-accounts/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.connectedAccount.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a user's public profile (README + connected accounts).
// Increments profileViewCount when viewed by someone other than the owner.
// profileViewCount is only returned to the owner (kept private).
router.get('/:id/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isOwner = id === req.user!.id;

    if (!isOwner) {
      // Best-effort increment; ignore if user does not exist (handled by findUnique below)
      await prisma.user.updateMany({
        where: { id },
        data: { profileViewCount: { increment: 1 } },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        statusText: true,
        profileReadme: true,
        profileViewCount: true,
        connectedAccounts: {
          select: { id: true, provider: true, url: true, displayName: true },
          orderBy: { createdAt: 'asc' },
        },
        receivedBadges: {
          select: {
            id: true,
            type: true,
            message: true,
            createdAt: true,
            fromUser: { select: { id: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) { res.status(404).json({ error: 'Not found' }); return; }

    const { profileViewCount, ...rest } = user;
    res.json({ ...rest, ...(isOwner ? { profileViewCount } : {}) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
