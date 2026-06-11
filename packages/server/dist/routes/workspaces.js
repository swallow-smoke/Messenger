"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const nanoid_1 = require("nanoid");
const prisma_1 = require("../lib/prisma");
const redis_1 = require("../lib/redis");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const router = express_1.default.Router();
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80),
    slug: zod_1.z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
});
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80).optional(),
    iconUrl: zod_1.z.string().url().optional(),
});
router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    try {
        const { name, slug } = req.body;
        const workspace = await prisma_1.prisma.workspace.create({
            data: {
                name,
                slug,
                ownerId: req.user.id,
                members: { create: { userId: req.user.id, role: 'owner' } },
            },
        });
        res.status(201).json(workspace);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const memberships = await prisma_1.prisma.workspaceMember.findMany({
            where: { userId: req.user.id },
            include: { workspace: true },
        });
        res.json(memberships.map((m) => ({ ...m.workspace, role: m.role })));
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const workspace = await prisma_1.prisma.workspace.findUniqueOrThrow({
            where: { id: req.params.id },
            include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } } } },
        });
        res.json(workspace);
    }
    catch {
        res.status(404).json({ error: 'Not found' });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, validate_1.validate)(updateSchema), async (req, res) => {
    try {
        const workspace = await prisma_1.prisma.workspace.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(workspace);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.workspace.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/:id/members', auth_1.requireAuth, async (req, res) => {
    try {
        const { userId, role } = req.body;
        const member = await prisma_1.prisma.workspaceMember.create({
            data: { workspaceId: req.params.id, userId, role: role ?? 'member' },
        });
        res.status(201).json(member);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id/members/:userId', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.workspaceMember.deleteMany({
            where: { workspaceId: req.params.id, userId: req.params.userId },
        });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/:id/invite', auth_1.requireAuth, async (req, res) => {
    try {
        const token = (0, nanoid_1.nanoid)(32);
        await (0, redis_1.setEx)(`invite:${token}`, 60 * 60 * 24, req.params.id);
        res.json({ inviteToken: token });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/join/:token', auth_1.requireAuth, async (req, res) => {
    try {
        const workspaceId = await (0, redis_1.getKey)(`invite:${req.params.token}`);
        if (!workspaceId) {
            res.status(404).json({ error: 'Invite expired or invalid' });
            return;
        }
        const member = await prisma_1.prisma.workspaceMember.upsert({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
            create: { workspaceId, userId: req.user.id, role: 'member' },
            update: {},
        });
        res.json(member);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=workspaces.js.map