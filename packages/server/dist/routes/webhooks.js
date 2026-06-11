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
    channelId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(1),
    type: zod_1.z.enum(['incoming', 'ci_cd', 'bot']).optional(),
});
router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    try {
        const { workspaceId, channelId, name, type } = req.body;
        const webhook = await prisma_1.prisma.webhook.create({
            data: { workspaceId, channelId, name, type: type ?? 'incoming', createdBy: req.user.id },
        });
        res.status(201).json(webhook);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const webhooks = await prisma_1.prisma.webhook.findMany({ where: { workspaceId } });
        res.json(webhooks);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.webhook.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// Public webhook endpoint — no auth required
router.post('/incoming/:token', async (req, res) => {
    try {
        const webhook = await prisma_1.prisma.webhook.findUnique({
            where: { token: req.params.token, isActive: true },
        });
        if (!webhook) {
            res.status(404).json({ error: 'Webhook not found' });
            return;
        }
        if (!webhook.channelId) {
            res.status(400).json({ error: 'Webhook has no target channel' });
            return;
        }
        const payload = req.body;
        const content = payload.text ?? JSON.stringify(payload);
        const metadata = payload.embed ? { embed: payload.embed } : {};
        const message = await prisma_1.prisma.message.create({
            data: {
                contextType: 'channel',
                contextId: webhook.channelId,
                senderId: webhook.createdBy,
                content,
                metadata: metadata,
            },
            include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
        });
        await prisma_1.prisma.webhook.update({
            where: { id: webhook.id },
            data: { lastTriggeredAt: new Date() },
        });
        const io = req.app.get('io');
        io.to(webhook.channelId).emit('message:new', message);
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map