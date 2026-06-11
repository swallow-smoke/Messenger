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
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    assigneeId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']).optional(),
    priority: zod_1.z.enum(['critical', 'high', 'medium', 'low']).optional(),
    type: zod_1.z.enum(['feature', 'bug', 'art', 'design', 'infra', 'etc']).optional(),
    dueDate: zod_1.z.string().optional(),
    linkedDocId: zod_1.z.string().uuid().optional(),
});
const updateSchema = createSchema.partial().omit({ workspaceId: true });
const commentSchema = zod_1.z.object({ content: zod_1.z.string().min(1) });
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { workspaceId, status, assigneeId, priority } = req.query;
        const tasks = await prisma_1.prisma.task.findMany({
            where: {
                workspaceId,
                ...(status ? { status: status } : {}),
                ...(assigneeId ? { assigneeId } : {}),
                ...(priority ? { priority: priority } : {}),
            },
            include: {
                assignee: { select: { id: true, displayName: true, avatarUrl: true } },
                creator: { select: { id: true, displayName: true } },
                _count: { select: { comments: true } },
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        });
        res.json(tasks);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    try {
        const { workspaceId, title, description, assigneeId, status, priority, type, dueDate, linkedDocId } = req.body;
        const task = await prisma_1.prisma.task.create({
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
                createdBy: req.user.id,
            },
            include: { assignee: { select: { id: true, displayName: true, avatarUrl: true } } },
        });
        res.status(201).json(task);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const task = await prisma_1.prisma.task.findUniqueOrThrow({
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
    }
    catch {
        res.status(404).json({ error: 'Not found' });
    }
});
router.patch('/:id', auth_1.requireAuth, (0, validate_1.validate)(updateSchema), async (req, res) => {
    try {
        const data = req.body;
        const task = await prisma_1.prisma.task.update({
            where: { id: req.params.id },
            data: {
                ...data,
                dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
            },
            include: { assignee: { select: { id: true, displayName: true, avatarUrl: true } } },
        });
        res.json(task);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.task.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/:id/comments', auth_1.requireAuth, (0, validate_1.validate)(commentSchema), async (req, res) => {
    try {
        const comment = await prisma_1.prisma.taskComment.create({
            data: { taskId: req.params.id, authorId: req.user.id, content: req.body.content },
            include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
        });
        res.status(201).json(comment);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/:id/comments', auth_1.requireAuth, async (req, res) => {
    try {
        const comments = await prisma_1.prisma.taskComment.findMany({
            where: { taskId: req.params.id },
            include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
        });
        res.json(comments);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=tasks.js.map