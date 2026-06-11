import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { notionService } from '../services/notion';
import type { Server as SocketServer } from 'socket.io';

export const router: Router = express.Router();

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().optional(),
  source: z.enum(['internal', 'notion', 'obsidian']).optional(),
  externalId: z.string().optional(),
  externalUrl: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  isArchived: z.boolean().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, q } = req.query as { workspaceId: string; q?: string };
    const docs = await prisma.document.findMany({
      where: {
        workspaceId,
        isArchived: false,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, source: true, externalId: true, externalUrl: true, updatedAt: true, createdBy: true },
    });
    res.json(docs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, title, content, source, externalId, externalUrl } = req.body as z.infer<typeof createSchema>;
    const doc = await prisma.document.create({
      data: { workspaceId, title, content: content ?? '', source: source ?? 'internal', externalId, externalUrl, createdBy: req.user!.id },
    });
    res.status(201).json(doc);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
    if (doc.source === 'notion' && doc.externalId) {
      const blocks = await notionService.getPage(doc.externalId);
      const content = await notionService.blocksToMarkdown(blocks);
      res.json({ ...doc, content });
      return;
    }
    if (doc.source === 'obsidian') {
      res.json({ ...doc, content: null });
      return;
    }
    res.json(doc);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.patch('/:id', requireAuth, validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { content, ...rest } = req.body as z.infer<typeof updateSchema>;
    const existing = await prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
    if (content !== undefined) {
      await prisma.documentVersion.create({
        data: { documentId: req.params.id, editedBy: req.user!.id, content: existing.content },
      });
    }
    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data: { ...rest, ...(content !== undefined ? { content } : {}) },
    });
    const io: SocketServer = req.app.get('io');
    io.to(doc.workspaceId).emit('doc:updated', { id: doc.id, title: doc.title, updatedAt: doc.updatedAt, workspaceId: doc.workspaceId });
    res.json(doc);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/versions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const versions = await prisma.documentVersion.findMany({
      where: { documentId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: { editor: { select: { id: true, displayName: true } } },
    });
    res.json(versions);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/versions/:vid', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const version = await prisma.documentVersion.findUniqueOrThrow({ where: { id: req.params.vid } });
    res.json(version);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
