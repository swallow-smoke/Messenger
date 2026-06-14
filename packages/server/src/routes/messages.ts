import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import type { Server as SocketServer } from 'socket.io';
import type { Prisma } from '@prisma/client';

const router: Router = express.Router();

const sendSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const editSchema = z.object({ content: z.string().min(1) });

const MSG_INCLUDE = {
  sender: { select: { id: true, displayName: true, avatarUrl: true } },
  attachments: true,
  reactions: { include: { user: { select: { id: true, displayName: true } } } },
  _count: { select: { replies: true } },
} as const;

router.get('/:channelId/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { before, after, limit = '50' } = req.query as { before?: string; after?: string; limit?: string };
    const take = Math.min(parseInt(limit), 100);
    const messages = await prisma.message.findMany({
      where: {
        contextType: 'channel',
        contextId: req.params.channelId,
        isDeleted: false,
        parentId: null,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
        ...(after ? { createdAt: { gte: new Date(after) } } : {}),
      },
      include: MSG_INCLUDE,
      orderBy: { createdAt: after ? 'asc' : 'desc' },
      take,
    });
    res.json(after ? messages : messages.reverse());
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/thread', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const replies = await prisma.message.findMany({
      where: { parentId: req.params.id, isDeleted: false },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        reactions: true,
        attachments: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(replies);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id', requireAuth, validate(editSchema), async (req: AuthRequest, res: Response) => {
  try {
    const current = await prisma.message.findUniqueOrThrow({ where: { id: req.params.id, senderId: req.user!.id } });
    const prevHistory = ((current.metadata as Record<string, unknown>).editHistory as Array<{ content: string; editedAt: string }>) ?? [];
    const editHistory = [...prevHistory, { content: current.content, editedAt: current.updatedAt.toISOString() }];
    const updatedMeta = { ...(current.metadata as Record<string, unknown>), editHistory } as Prisma.InputJsonValue;
    const message = await prisma.message.update({
      where: { id: req.params.id, senderId: req.user!.id },
      data: { content: req.body.content, isEdited: true, metadata: updatedMeta },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true } }, attachments: true, reactions: true },
    });
    const io: SocketServer = req.app.get('io');
    io.to(message.contextId).emit('message:update', message);
    res.json(message);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/tag', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { buildTag } = req.body as { buildTag: string | null };
    const current = await prisma.message.findUniqueOrThrow({ where: { id: req.params.id } });
    const updatedMeta = { ...(current.metadata as Record<string, unknown>), buildTag: buildTag ?? undefined } as Prisma.InputJsonValue;
    const message = await prisma.message.update({
      where: { id: req.params.id },
      data: { metadata: updatedMeta },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true } }, attachments: true, reactions: true },
    });
    const io: SocketServer = req.app.get('io');
    io.to(message.contextId).emit('message:update', message);
    res.json(message);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.update({
      where: { id: req.params.id, senderId: req.user!.id },
      data: { isDeleted: true },
    });
    const io: SocketServer = req.app.get('io');
    io.to(message.contextId).emit('message:delete', { id: message.id, contextId: message.contextId });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/reactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { emoji } = req.body as { emoji: string };
    if (!emoji) { res.status(400).json({ error: 'emoji required' }); return; }
    const reaction = await prisma.reaction.create({
      data: { messageId: req.params.id, userId: req.user!.id, emoji },
      include: { user: { select: { id: true, displayName: true } } },
    });
    const message = await prisma.message.findUniqueOrThrow({ where: { id: req.params.id } });
    const io: SocketServer = req.app.get('io');
    io.to(message.contextId).emit('message:reaction', { messageId: req.params.id, reaction, action: 'add' });
    res.status(201).json(reaction);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/reactions/:emoji', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const emoji = decodeURIComponent(req.params.emoji);
    await prisma.reaction.deleteMany({
      where: { messageId: req.params.id, userId: req.user!.id, emoji },
    });
    const message = await prisma.message.findUniqueOrThrow({ where: { id: req.params.id } });
    const io: SocketServer = req.app.get('io');
    io.to(message.contextId).emit('message:reaction', {
      messageId: req.params.id,
      emoji,
      userId: req.user!.id,
      action: 'remove',
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Pin message to channel
router.post('/:id/pin', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true } }, attachments: true, reactions: true },
    });
    if (message.contextType !== 'channel') { res.status(400).json({ error: 'Can only pin channel messages' }); return; }
    const pin = await prisma.pinnedMessage.upsert({
      where: { channelId_messageId: { channelId: message.contextId, messageId: message.id } },
      create: { channelId: message.contextId, messageId: message.id, pinnedBy: req.user!.id },
      update: {},
    });
    const io: SocketServer = req.app.get('io');
    io.to(message.contextId).emit('message:pinned', { message, pinnedBy: req.user!.id, channelId: message.contextId });
    res.json(pin);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/pin', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.findUniqueOrThrow({ where: { id: req.params.id } });
    await prisma.pinnedMessage.deleteMany({
      where: { channelId: message.contextId, messageId: message.id },
    });
    const io: SocketServer = req.app.get('io');
    io.to(message.contextId).emit('message:unpinned', { messageId: message.id, channelId: message.contextId });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Bookmark message
router.post('/:id/bookmark', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const bookmark = await prisma.bookmark.upsert({
      where: { userId_messageId: { userId: req.user!.id, messageId: req.params.id } },
      create: { userId: req.user!.id, messageId: req.params.id },
      update: {},
    });
    res.json(bookmark);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/bookmark', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.bookmark.deleteMany({ where: { userId: req.user!.id, messageId: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
