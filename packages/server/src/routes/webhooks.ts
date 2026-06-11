import express, { type Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import type { Server as SocketServer } from 'socket.io';

const router: Router = express.Router();

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  channelId: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(['incoming', 'ci_cd', 'bot']).optional(),
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, channelId, name, type } = req.body as z.infer<typeof createSchema>;
    const token = randomBytes(32).toString('hex');
    const webhook = await prisma.webhook.create({
      data: { workspaceId, channelId, name, type: type ?? 'incoming', createdBy: req.user!.id, token },
    });
    res.status(201).json(webhook);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.query as { workspaceId: string };
    const webhooks = await prisma.webhook.findMany({ where: { workspaceId } });
    res.json(webhooks);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.webhook.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public webhook endpoint — no auth required
router.post('/incoming/:token', async (req: Request, res: Response) => {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { token: req.params.token, isActive: true },
    });
    if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return; }

    if (!webhook.channelId) { res.status(400).json({ error: 'Webhook has no target channel' }); return; }

    const payload = req.body as { text?: string; username?: string; embed?: unknown };
    const content = payload.text ?? JSON.stringify(payload);
    const metadata = payload.embed ? { embed: payload.embed } : {};

    const message = await prisma.message.create({
      data: {
        contextType: 'channel',
        contextId: webhook.channelId,
        senderId: webhook.createdBy,
        content,
        metadata: metadata as InputJsonValue,
      },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { lastTriggeredAt: new Date() },
    });

    const io: SocketServer = req.app.get('io');
    io.to(webhook.channelId).emit('message:new', message);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
