"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const router = express_1.default.Router();
const sendSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
    parentId: zod_1.z.string().uuid().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const editSchema = zod_1.z.object({ content: zod_1.z.string().min(1) });
router.get('/:channelId/messages', auth_1.requireAuth, async (req, res) => {
    try {
        const { before, limit = '50' } = req.query;
        const take = Math.min(parseInt(limit), 100);
        const messages = await prisma_1.prisma.message.findMany({
            where: {
                contextType: 'channel',
                contextId: req.params.channelId,
                isDeleted: false,
                parentId: null,
                ...(before ? { createdAt: { lt: new Date(before) } } : {}),
            },
            include: {
                sender: { select: { id: true, displayName: true, avatarUrl: true } },
                attachments: true,
                reactions: { include: { user: { select: { id: true, displayName: true } } } },
                _count: { select: { replies: true } },
            },
            orderBy: { createdAt: 'desc' },
            take,
        });
        res.json(messages.reverse());
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/:id/thread', auth_1.requireAuth, async (req, res) => {
    try {
        const replies = await prisma_1.prisma.message.findMany({
            where: { parentId: req.params.id, isDeleted: false },
            include: {
                sender: { select: { id: true, displayName: true, avatarUrl: true } },
                reactions: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(replies);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, validate_1.validate)(editSchema), async (req, res) => {
    try {
        const message = await prisma_1.prisma.message.update({
            where: { id: req.params.id, senderId: req.user.id },
            data: { content: req.body.content, isEdited: true },
            include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
        });
        const io = req.app.get('io');
        io.to(message.contextId).emit('message:update', message);
        res.json(message);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const message = await prisma_1.prisma.message.update({
            where: { id: req.params.id, senderId: req.user.id },
            data: { isDeleted: true },
        });
        const io = req.app.get('io');
        io.to(message.contextId).emit('message:delete', { id: message.id });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/:id/reactions', auth_1.requireAuth, async (req, res) => {
    try {
        const { emoji } = req.body;
        if (!emoji) {
            res.status(400).json({ error: 'emoji required' });
            return;
        }
        const reaction = await prisma_1.prisma.reaction.create({
            data: { messageId: req.params.id, userId: req.user.id, emoji },
        });
        const message = await prisma_1.prisma.message.findUniqueOrThrow({ where: { id: req.params.id } });
        const io = req.app.get('io');
        io.to(message.contextId).emit('message:reaction', { messageId: req.params.id, reaction, action: 'add' });
        res.status(201).json(reaction);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id/reactions/:emoji', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.reaction.deleteMany({
            where: { messageId: req.params.id, userId: req.user.id, emoji: req.params.emoji },
        });
        const message = await prisma_1.prisma.message.findUniqueOrThrow({ where: { id: req.params.id } });
        const io = req.app.get('io');
        io.to(message.contextId).emit('message:reaction', { messageId: req.params.id, emoji: req.params.emoji, userId: req.user.id, action: 'remove' });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=messages.js.map