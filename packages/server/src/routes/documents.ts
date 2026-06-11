import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { notionService } from '../services/notion';
import type { Server as SocketServer } from 'socket.io';
import type { InputJsonValue } from '@prisma/client/runtime/library';

export const router: Router = express.Router();

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().optional(),
  source: z.enum(['internal', 'notion', 'obsidian']).optional(),
  externalId: z.string().optional(),
  externalUrl: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  isArchived: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const commentSchema = z.object({
  content: z.string().min(1).max(4000),
  parentId: z.string().uuid().optional(),
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
      select: {
        id: true,
        title: true,
        source: true,
        externalId: true,
        externalUrl: true,
        updatedAt: true,
        createdAt: true,
        createdBy: true,
        metadata: true,
        _count: { select: { comments: true } },
      },
    });
    res.json(docs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, title, content, source, externalId, externalUrl, metadata } =
      req.body as z.infer<typeof createSchema>;
    const doc = await prisma.document.create({
      data: {
        workspaceId,
        title,
        content: content ?? '',
        source: source ?? 'internal',
        externalId,
        externalUrl,
        createdBy: req.user!.id,
        metadata: (metadata ?? {}) as InputJsonValue,
      },
    });
    res.status(201).json(doc);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.document.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { editor: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
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
    const { content, metadata, ...rest } = req.body as z.infer<typeof updateSchema>;
    const existing = await prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
    if (content !== undefined) {
      await prisma.documentVersion.create({
        data: { documentId: req.params.id, editedBy: req.user!.id, content: existing.content },
      });
    }
    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(content !== undefined ? { content } : {}),
        ...(metadata !== undefined ? { metadata: metadata as InputJsonValue } : {}),
      },
    });
    const io: SocketServer = req.app.get('io');
    io.to(doc.workspaceId).emit('doc:updated', {
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
      workspaceId: doc.workspaceId,
    });
    res.json(doc);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc || doc.createdBy !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await prisma.document.update({ where: { id: req.params.id }, data: { isArchived: true } });
    res.status(204).end();
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

// Comments

router.get('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const comments = await prisma.documentComment.findMany({
      where: { documentId: req.params.id, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });
    res.json(comments);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/comments', requireAuth, validate(commentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { content, parentId } = req.body as z.infer<typeof commentSchema>;
    const comment = await prisma.documentComment.create({
      data: {
        documentId: req.params.id,
        authorId: req.user!.id,
        content,
        parentId,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        replies: {
          include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
    res.status(201).json(comment);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/comments/:commentId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.documentComment.findUnique({
      where: { id: req.params.commentId },
    });
    if (!comment || comment.authorId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await prisma.documentComment.delete({ where: { id: req.params.commentId } });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
