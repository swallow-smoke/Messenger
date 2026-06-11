import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { setEx, getKey } from '../lib/redis';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router: Router = express.Router();

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + nanoid(4);
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  iconUrl: z.string().url().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  iconUrl: z.string().url().nullable().optional(),
});

const memberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, iconUrl } = req.body as z.infer<typeof createSchema>;
    const slug = makeSlug(name);
    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        iconUrl,
        ownerId: req.user!.id,
        members: { create: { userId: req.user!.id, role: 'owner' } },
      },
    });
    res.status(201).json(workspace);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.id },
      include: { workspace: true },
    });
    res.json(memberships.map((m) => ({ ...m.workspace, role: m.role })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } },
        },
      },
    });
    res.json(workspace);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.patch('/:id', requireAuth, validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(workspace);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.workspace.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Members
router.get('/:id/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.params.id },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, email: true, status: true, statusText: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt, memberId: m.id })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.body as { userId: string; role?: string };
    const member = await prisma.workspaceMember.create({
      data: { workspaceId: req.params.id, userId, role: (role as 'admin' | 'member') ?? 'member' },
    });
    res.status(201).json(member);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/members/:userId', requireAuth, validate(memberRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    // Only owner/admin can change roles
    const caller = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.user!.id } },
    });
    if (!caller || (caller.role !== 'owner' && caller.role !== 'admin')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    const { role } = req.body as z.infer<typeof memberRoleSchema>;
    const member = await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.userId } },
      data: { role },
    });
    res.json(member);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/members/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: req.params.id, userId: req.params.userId },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/invite', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const token = nanoid(32);
    await setEx(`invite:${token}`, 60 * 60 * 24, req.params.id);
    res.json({ inviteToken: token });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/join/:token', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = await getKey(`invite:${req.params.token}`);
    if (!workspaceId) { res.status(404).json({ error: 'Invite expired or invalid' }); return; }
    const member = await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: req.user!.id } },
      create: { workspaceId, userId: req.user!.id, role: 'member' },
      update: {},
    });
    res.json(member);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
