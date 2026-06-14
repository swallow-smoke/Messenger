import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hasPermission } from '../lib/permissions';
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
  rules: z.string().max(2000).nullable().optional(),
  isArchived: z.boolean().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isPrivate, workspaceId } = req.body as z.infer<typeof createSchema>;
    if (!await hasPermission(req.user!.id, workspaceId, 'manageChannels')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
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
      include: { channel: { include: { category: { select: { id: true, name: true } } } } },
    });
    res.json(memberships.map((m) => ({
      ...m.channel,
      categoryName: m.channel.category?.name ?? null,
      lastReadAt: m.lastReadAt,
    })));
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
    const existing = await prisma.channel.findUniqueOrThrow({ where: { id: req.params.id }, select: { workspaceId: true } });
    if (!await hasPermission(req.user!.id, existing.workspaceId, 'manageChannels')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
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
    if (!await hasPermission(req.user!.id, channel.workspaceId, 'manageChannels')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
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
        user: { select: { id: true, displayName: true, avatarUrl: true, status: true, statusText: true, lastSeenAt: true } },
      },
    });
    res.json(
      members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status,
        statusText: m.user.statusText,
        lastSeenAt: m.user.lastSeenAt,
        role: 'member',
      }))
    );
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Attachment gallery for a channel (filterable by type)
router.get('/:id/attachments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query as { type?: string };
    const mimeFilter: Record<string, object> = {
      image: { startsWith: 'image/' },
      video: { startsWith: 'video/' },
      code: { in: ['text/plain'] },
    };
    const fileNameFilter: Record<string, object> = {
      '3d': { in: ['.glb', '.gltf', '.fbx'] },
      code: {},
    };

    const attachments = await prisma.attachment.findMany({
      where: {
        message: { contextType: 'channel', contextId: req.params.id, isDeleted: false },
        ...(type === 'image' ? { mimeType: { startsWith: 'image/' } } : {}),
        ...(type === 'video' ? { mimeType: { startsWith: 'video/' } } : {}),
        ...(type === '3d' ? { OR: [{ fileName: { endsWith: '.glb' } }, { fileName: { endsWith: '.gltf' } }, { fileName: { endsWith: '.fbx' } }] } : {}),
        ...(type === 'code' ? { OR: [{ fileName: { endsWith: '.cs' } }, { fileName: { endsWith: '.ts' } }, { fileName: { endsWith: '.js' } }, { fileName: { endsWith: '.json' } }] } : {}),
      },
      include: { message: { select: { id: true, createdAt: true, sender: { select: { id: true, displayName: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    void mimeFilter; void fileNameFilter;
    res.json(attachments);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Previous attachment version lookup for diff (returns latest prior upload with same filename)
router.get('/:id/attachment-history/:filename', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { excludeMessageId } = req.query as { excludeMessageId?: string };
    const previous = await prisma.attachment.findFirst({
      where: {
        fileName: req.params.filename,
        message: {
          contextType: 'channel',
          contextId: req.params.id,
          isDeleted: false,
          ...(excludeMessageId ? { NOT: { id: excludeMessageId } } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(previous ?? null);
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
