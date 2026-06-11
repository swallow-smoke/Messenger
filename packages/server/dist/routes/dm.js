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
const createSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().uuid(),
    memberIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    name: zod_1.z.string().optional(),
});
router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    try {
        const { workspaceId, memberIds, name } = req.body;
        const allIds = [...new Set([req.user.id, ...memberIds])];
        const isGroup = allIds.length > 2;
        const conversation = await prisma_1.prisma.directConversation.create({
            data: {
                workspaceId,
                isGroup,
                name,
                members: { create: allIds.map((userId) => ({ userId })) },
            },
            include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
        });
        res.status(201).json(conversation);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const memberships = await prisma_1.prisma.directMember.findMany({
            where: { userId: req.user.id, conversation: { workspaceId } },
            include: {
                conversation: {
                    include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } } } },
                },
            },
        });
        res.json(memberships.map((m) => ({ ...m.conversation, lastReadAt: m.lastReadAt })));
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/:conversationId/messages', auth_1.requireAuth, async (req, res) => {
    try {
        const { before, limit = '50' } = req.query;
        const take = Math.min(parseInt(limit), 100);
        const messages = await prisma_1.prisma.message.findMany({
            where: {
                contextType: 'dm',
                contextId: req.params.conversationId,
                isDeleted: false,
                parentId: null,
                ...(before ? { createdAt: { lt: new Date(before) } } : {}),
            },
            include: {
                sender: { select: { id: true, displayName: true, avatarUrl: true } },
                attachments: true,
                reactions: true,
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
exports.default = router;
//# sourceMappingURL=dm.js.map