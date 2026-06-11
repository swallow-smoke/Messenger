"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
exports.router = express_1.default.Router();
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80),
    description: zod_1.z.string().optional(),
    isPrivate: zod_1.z.boolean().optional(),
    workspaceId: zod_1.z.string().uuid(),
});
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80).optional(),
    description: zod_1.z.string().optional(),
    isArchived: zod_1.z.boolean().optional(),
});
exports.router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    try {
        const { name, description, isPrivate, workspaceId } = req.body;
        const channel = await prisma_1.prisma.channel.create({
            data: {
                name,
                description,
                isPrivate: isPrivate ?? false,
                workspaceId,
                createdBy: req.user.id,
                members: { create: { userId: req.user.id } },
            },
        });
        res.status(201).json(channel);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const memberships = await prisma_1.prisma.channelMember.findMany({
            where: { userId: req.user.id, channel: { workspaceId, isArchived: false } },
            include: { channel: true },
        });
        res.json(memberships.map((m) => ({ ...m.channel, lastReadAt: m.lastReadAt })));
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const channel = await prisma_1.prisma.channel.findUniqueOrThrow({
            where: { id: req.params.id },
            include: {
                members: {
                    include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } },
                },
            },
        });
        res.json(channel);
    }
    catch {
        res.status(404).json({ error: 'Not found' });
    }
});
exports.router.patch('/:id', auth_1.requireAuth, (0, validate_1.validate)(updateSchema), async (req, res) => {
    try {
        const channel = await prisma_1.prisma.channel.update({ where: { id: req.params.id }, data: req.body });
        res.json(channel);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.channel.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.post('/:id/members', auth_1.requireAuth, async (req, res) => {
    try {
        const { userId } = req.body;
        const member = await prisma_1.prisma.channelMember.create({
            data: { channelId: req.params.id, userId },
        });
        res.status(201).json(member);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.delete('/:id/members/:userId', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.channelMember.deleteMany({
            where: { channelId: req.params.id, userId: req.params.userId },
        });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.post('/:id/read', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.channelMember.updateMany({
            where: { channelId: req.params.id, userId: req.user.id },
            data: { lastReadAt: new Date() },
        });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = exports.router;
//# sourceMappingURL=channels.js.map