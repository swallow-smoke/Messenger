import express, { type Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import type { Prisma } from '@prisma/client';

const router: Router = express.Router();

interface SearchOperators {
  from?: string;
  in?: string;
  has?: string;
  before?: string;
  after?: string;
  text: string;
}

function parseQuery(raw: string): SearchOperators {
  const ops: SearchOperators = { text: '' };
  const remaining: string[] = [];
  for (const token of raw.trim().split(/\s+/)) {
    const m = /^(from|in|has|before|after):(.+)$/.exec(token);
    if (m) {
      const key = m[1] as keyof Omit<SearchOperators, 'text'>;
      ops[key] = m[2];
    } else {
      remaining.push(token);
    }
  }
  ops.text = remaining.join(' ');
  return ops;
}

router.get('/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { q = '', workspaceId } = req.query as { q?: string; workspaceId?: string };
    if (!workspaceId) { res.status(400).json({ error: 'workspaceId required' }); return; }

    const ops = parseQuery(q);

    // Get workspace channel IDs (optionally filtered by name)
    const channelFilter: Prisma.ChannelWhereInput = { workspaceId };
    if (ops.in) channelFilter.name = { contains: ops.in, mode: 'insensitive' };
    const channels = await prisma.channel.findMany({ where: channelFilter, select: { id: true, name: true } });
    const channelIds = channels.map((c) => c.id);

    const where: Prisma.MessageWhereInput = {
      isDeleted: false,
      contextType: 'channel',
      contextId: { in: channelIds },
    };

    if (ops.text) {
      where.content = { contains: ops.text, mode: 'insensitive' };
    }

    if (ops.from) {
      where.sender = { displayName: { contains: ops.from, mode: 'insensitive' } };
    }

    if (ops.before || ops.after) {
      where.createdAt = {
        ...(ops.before ? { lt: new Date(ops.before) } : {}),
        ...(ops.after ? { gte: new Date(ops.after) } : {}),
      };
    }

    if (ops.has) {
      const hasType = ops.has.toLowerCase();
      if (hasType === 'image') {
        where.attachments = { some: { mimeType: { startsWith: 'image/' } } };
      } else if (hasType === 'file') {
        where.attachments = { some: {} };
      } else if (hasType === '3d') {
        where.attachments = { some: { OR: [{ fileName: { endsWith: '.glb' } }, { fileName: { endsWith: '.gltf' } }, { fileName: { endsWith: '.fbx' } }] } };
      } else if (hasType === 'code') {
        where.attachments = { some: { OR: [{ fileName: { endsWith: '.cs' } }, { fileName: { endsWith: '.ts' } }, { fileName: { endsWith: '.js' } }] } };
      }
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        attachments: true,
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Attach channel name for display
    const channelMap = new Map(channels.map((c) => [c.id, c.name]));
    const result = messages.map((m) => ({ ...m, channelName: channelMap.get(m.contextId) ?? null }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
