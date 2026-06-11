import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import type { Server as SocketServer } from 'socket.io';

const router: Router = express.Router();

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()).min(1),
  name: z.string().optional(),
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, memberIds, name } = req.body as z.infer<typeof createSchema>;
    const allIds = [...new Set([req.user!.id, ...memberIds])];
    const isGroup = allIds.length > 2;
    const conversation = await prisma.directConversation.create({
      data: {
        workspaceId,
        isGroup,
        name,
        members: { create: allIds.map((userId) => ({ userId })) },
      },
      include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
    });
    res.status(201).json(conversation);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.query as { workspaceId: string };
    const memberships = await prisma.directMember.findMany({
      where: { userId: req.user!.id, conversation: { workspaceId } },
      include: {
        conversation: {
          include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } } } },
        },
      },
    });
    res.json(memberships.map((m: any) => ({ ...m.conversation, lastReadAt: m.lastReadAt })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:conversationId/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { before, limit = '50' } = req.query as { before?: string; limit?: string };
    const take = Math.min(parseInt(limit), 100);
    const messages = await prisma.message.findMany({
      where: {
        contextType: 'dm',
        contextId: req.params.conversationId,
        isDeleted: false,
        parentId: null,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        attachments: true,
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json(messages.reverse());
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:conversationId/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body as { content: string };
    if (!content?.trim()) { res.status(400).json({ error: 'Content required' }); return; }
    const message = await prisma.message.create({
      data: {
        contextType: 'dm',
        contextId: req.params.conversationId,
        senderId: req.user!.id,
        content,
      },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true } }, attachments: true, reactions: true },
    });
    const io: SocketServer = req.app.get('io');
    io.to(req.params.conversationId).emit('message:new', message);
    res.status(201).json(message);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
