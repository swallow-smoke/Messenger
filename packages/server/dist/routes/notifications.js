"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const notifications = await prisma_1.prisma.notification.findMany({
            where: { userId: req.user.id },
            include: { message: { select: { id: true, content: true, contextId: true, contextType: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json(notifications);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.patch('/:id/read', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.notification.update({
            where: { id: req.params.id, userId: req.user.id },
            data: { isRead: true },
        });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/read-all', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true },
        });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map