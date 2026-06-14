import express, { type Router, Response } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { setEx, getKey } from '../lib/redis';
import { hasPermission } from '../lib/permissions';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import type { Prisma } from '@prisma/client';

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

const roleCreateSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).optional(),
  manageChannels: z.boolean().optional(),
  manageRoles: z.boolean().optional(),
  manageMembers: z.boolean().optional(),
  kickMembers: z.boolean().optional(),
  banMembers: z.boolean().optional(),
  deleteAnyMessage: z.boolean().optional(),
  manageWebhooks: z.boolean().optional(),
});

const roleUpdateSchema = roleCreateSchema.partial();

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
        user: { select: { id: true, displayName: true, avatarUrl: true, email: true, status: true, statusText: true, lastSeenAt: true } },
        assignedRoles: {
          include: { role: { select: { id: true, name: true, color: true, position: true } } },
          orderBy: { role: { position: 'asc' } },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(members.map((m) => ({
      ...m.user,
      role: m.role,
      joinedAt: m.joinedAt,
      memberId: m.id,
      roles: m.assignedRoles.map((ar) => ar.role),
    })));
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
    if (!await hasPermission(req.user!.id, req.params.id, 'manageMembers')) {
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
    if (!await hasPermission(req.user!.id, req.params.id, 'kickMembers')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: req.params.id, userId: req.params.userId },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Member role assignment
router.post('/:id/members/:userId/roles', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!await hasPermission(req.user!.id, req.params.id, 'manageRoles')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    const { roleId } = req.body as { roleId: string };
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.userId } },
    });
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }
    await prisma.workspaceMemberRole.create({ data: { memberId: member.id, roleId } });
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/members/:userId/roles/:roleId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!await hasPermission(req.user!.id, req.params.id, 'manageRoles')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.userId } },
    });
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }
    await prisma.workspaceMemberRole.deleteMany({
      where: { memberId: member.id, roleId: req.params.roleId },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Roles CRUD
router.get('/:id/roles', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      where: { workspaceId: req.params.id },
      orderBy: { position: 'asc' },
    });
    res.json(roles);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/roles', requireAuth, validate(roleCreateSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!await hasPermission(req.user!.id, req.params.id, 'manageRoles')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    const body = req.body as z.infer<typeof roleCreateSchema>;
    const role = await prisma.role.create({
      data: { ...body, workspaceId: req.params.id },
    });
    res.status(201).json(role);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/roles/:roleId', requireAuth, validate(roleUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!await hasPermission(req.user!.id, req.params.id, 'manageRoles')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    const body = req.body as z.infer<typeof roleUpdateSchema>;
    const role = await prisma.role.update({
      where: { id: req.params.roleId },
      data: body,
    });
    res.json(role);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/roles/:roleId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!await hasPermission(req.user!.id, req.params.id, 'manageRoles')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    await prisma.role.delete({ where: { id: req.params.roleId } });
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
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    res.json({ member, workspace });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.user!.id } },
    });
    if (!member) { res.status(404).json({ error: 'Not a member' }); return; }
    if (member.role === 'owner') { res.status(400).json({ error: 'Owner cannot leave — transfer ownership first' }); return; }
    await prisma.workspaceMember.delete({ where: { id: member.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Export ────────────────────────────────────────────────────────────────────
router.get('/:id/export', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.user!.id } },
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        categories: { orderBy: { position: 'asc' } },
        roles: { orderBy: { position: 'asc' } },
        channels: { where: { isArchived: false }, orderBy: { createdAt: 'asc' } },
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true } },
            assignedRoles: { include: { role: { select: { id: true } } } },
          },
        },
      },
    });

    const channelIds = workspace.channels.map((c) => c.id);
    const messages = channelIds.length
      ? await prisma.message.findMany({
          where: { contextType: 'channel', contextId: { in: channelIds }, isDeleted: false },
          include: { sender: { select: { displayName: true } }, attachments: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      workspace: {
        name: workspace.name,
        categories: workspace.categories,
        roles: workspace.roles,
        channels: workspace.channels.map((c) => ({
          id: c.id, name: c.name, description: c.description,
          rules: c.rules, isPrivate: c.isPrivate, categoryId: c.categoryId,
        })),
        members: workspace.members.map((m) => ({
          displayName: m.user.displayName,
          email: m.user.email,
          role: m.role,
          roleIds: m.assignedRoles.map((ar) => ar.role.id),
        })),
      },
      messages: messages.map((m) => ({
        channelId: m.contextId,
        senderDisplayName: m.sender.displayName,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
        attachments: m.attachments.map((a) => ({
          fileName: a.fileName, fileUrl: a.fileUrl, mimeType: a.mimeType, fileSize: a.fileSize,
        })),
      })),
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Import ────────────────────────────────────────────────────────────────────
interface ImportCategory { id: string; name: string; position: number; }
interface ImportRole {
  id: string; name: string; color: string; position: number;
  manageChannels: boolean; manageRoles: boolean; manageMembers: boolean;
  kickMembers: boolean; banMembers: boolean; deleteAnyMessage: boolean; manageWebhooks: boolean;
}
interface ImportChannel { id: string; name: string; description?: string | null; rules?: string | null; isPrivate: boolean; categoryId?: string | null; }
interface ImportMessage { channelId: string; senderDisplayName: string; content: string; metadata: Record<string, unknown>; createdAt: string; }
interface ImportData {
  version: number;
  workspace: { name: string; categories?: ImportCategory[]; roles?: ImportRole[]; channels?: ImportChannel[]; };
  messages?: ImportMessage[];
}

router.post('/import', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as ImportData;
    if (!body.version || !body.workspace?.name) {
      res.status(400).json({ error: 'Invalid import format' }); return;
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: body.workspace.name,
        slug: makeSlug(body.workspace.name),
        ownerId: req.user!.id,
        members: { create: { userId: req.user!.id, role: 'owner' } },
      },
    });

    const categoryMap = new Map<string, string>();
    for (const cat of (body.workspace.categories ?? [])) {
      const c = await prisma.channelCategory.create({
        data: { workspaceId: workspace.id, name: cat.name, position: cat.position },
      });
      categoryMap.set(cat.id, c.id);
    }

    const roleMap = new Map<string, string>();
    for (const role of (body.workspace.roles ?? [])) {
      const r = await prisma.role.create({
        data: {
          workspaceId: workspace.id, name: role.name, color: role.color, position: role.position,
          manageChannels: role.manageChannels, manageRoles: role.manageRoles,
          manageMembers: role.manageMembers, kickMembers: role.kickMembers,
          banMembers: role.banMembers, deleteAnyMessage: role.deleteAnyMessage,
          manageWebhooks: role.manageWebhooks,
        },
      });
      roleMap.set(role.id, r.id);
    }

    const channelMap = new Map<string, string>();
    for (const ch of (body.workspace.channels ?? [])) {
      const c = await prisma.channel.create({
        data: {
          workspaceId: workspace.id, name: ch.name, description: ch.description ?? undefined,
          rules: ch.rules ?? undefined, isPrivate: ch.isPrivate, createdBy: req.user!.id,
          categoryId: ch.categoryId ? (categoryMap.get(ch.categoryId) ?? null) : null,
          members: { create: { userId: req.user!.id } },
        },
      });
      channelMap.set(ch.id, c.id);
    }

    for (const msg of (body.messages ?? [])) {
      const newChannelId = channelMap.get(msg.channelId);
      if (!newChannelId) continue;
      await prisma.message.create({
        data: {
          contextType: 'channel',
          contextId: newChannelId,
          senderId: req.user!.id,
          content: msg.content,
          metadata: { ...(msg.metadata ?? {}), importedFrom: { displayName: msg.senderDisplayName } } as Prisma.InputJsonValue,
          createdAt: new Date(msg.createdAt),
        },
      });
    }

    res.status(201).json({ workspace });
  } catch (err) {
    console.error('[import] error:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
