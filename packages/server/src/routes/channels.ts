import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import type { Server as SocketServer } from 'socket.io';

export const router: Router = express.Router();

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
  workspaceId: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().optional(),
  isArchived: z.boolean().optional(),
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isPrivate, workspaceId } = req.body as z.infer<typeof createSchema>;
    const channel = await prisma.channel.create({
      data: {
        name: name.replace(/^#/, '').toLowerCase().replace(/\s+/g, '-'),
        description,
        isPrivate: isPrivate ?? false,
        workspaceId,
        createdBy: req.user!.id,
        members: { create: { userId: req.user!.id } },
      },
    });
    const io: SocketServer = req.app.get('io');
    io.to(workspaceId).emit('channel:created', channel);
    res.status(201).json(channel);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.query as { workspaceId: string };
    const memberships = await prisma.channelMember.findMany({
      where: { userId: req.user!.id, channel: { workspaceId, isArchived: false } },
      include: { channel: true },
    });
    res.json(memberships.map((m) => ({ ...m.channel, lastReadAt: m.lastReadAt })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const channel = await prisma.channel.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } },
        },
      },
    });
    res.json(channel);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.patch('/:id', requireAuth, validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const channel = await prisma.channel.update({ where: { id: req.params.id }, data: req.body });
    const io: SocketServer = req.app.get('io');
    io.to(channel.workspaceId).emit('channel:updated', channel);
    res.json(channel);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: req.params.id } });
    await prisma.channel.delete({ where: { id: req.params.id } });
    const io: SocketServer = req.app.get('io');
    io.to(channel.workspaceId).emit('channel:deleted', { id: channel.id, workspaceId: channel.workspaceId });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body as { userId: string };
    const member = await prisma.channelMember.create({ data: { channelId: req.params.id, userId } });
    res.status(201).json(member);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/members/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.channelMember.deleteMany({ where: { channelId: req.params.id, userId: req.params.userId } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.channelMember.updateMany({
      where: { channelId: req.params.id, userId: req.user!.id },
      data: { lastReadAt: new Date() },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Channel members list
router.get('/:id/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.channelMember.findMany({
      where: { channelId: req.params.id },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, status: true, statusText: true } },
      },
    });
    res.json(
      members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status,
        statusText: m.user.statusText,
        role: 'member',
      }))
    );
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Pinned messages
router.get('/:id/pins', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const pins = await prisma.pinnedMessage.findMany({
      where: { channelId: req.params.id },
      include: {
        message: {
          include: {
            sender: { select: { id: true, displayName: true, avatarUrl: true } },
            attachments: true,
            reactions: true,
          },
        },
        pinner: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pins.map((p) => ({ ...p.message, pinnedBy: p.pinner, pinnedAt: p.createdAt })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
