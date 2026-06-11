import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import type { Server as SocketServer } from 'socket.io';

const router: Router = express.Router();

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().uuid().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  type: z.enum(['feature', 'bug', 'art', 'design', 'infra', 'etc']).optional(),
  dueDate: z.string().optional(),
  linkedDocId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial().omit({ workspaceId: true });

const commentSchema = z.object({ content: z.string().min(1) });

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, status, assigneeId, priority } = req.query as Record<string, string>;
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        ...(status ? { status: status as 'backlog' } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(priority ? { priority: priority as 'critical' } : {}),
      },
      include: {
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        creator: { select: { id: true, displayName: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, title, description, assigneeId, status, priority, type, dueDate, linkedDocId } =
      req.body as z.infer<typeof createSchema>;
    const task = await prisma.task.create({
      data: {
        workspaceId,
        title,
        description,
        assigneeId,
        status: status ?? 'backlog',
        priority: priority ?? 'medium',
        type: type ?? 'etc',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        linkedDocId,
        createdBy: req.user!.id,
      },
      include: { assignee: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    const io: SocketServer = req.app.get('io');
    io.to(workspaceId).emit('task:created', task);
    res.status(201).json(task);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        creator: { select: { id: true, displayName: true } },
        linkedDoc: { select: { id: true, title: true } },
        comments: {
          include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json(task);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.patch('/:id', requireAuth, validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body as z.infer<typeof updateSchema>;
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: { assignee: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    const io: SocketServer = req.app.get('io');
    io.to(task.workspaceId).emit('task:updated', task);
    if (data.status) io.to(task.workspaceId).emit('task:status-changed', { id: task.id, status: task.status, workspaceId: task.workspaceId });
    res.json(task);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/comments', requireAuth, validate(commentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.taskComment.create({
      data: { taskId: req.params.id, authorId: req.user!.id, content: req.body.content },
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    res.status(201).json(comment);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const comments = await prisma.taskComment.findMany({
      where: { taskId: req.params.id },
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
