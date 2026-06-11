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
const notion_1 = require("../services/notion");
exports.router = express_1.default.Router();
const createSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1),
    content: zod_1.z.string().optional(),
    source: zod_1.z.enum(['internal', 'notion', 'obsidian']).optional(),
    externalId: zod_1.z.string().optional(),
    externalUrl: zod_1.z.string().optional(),
});
const updateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    content: zod_1.z.string().optional(),
    isArchived: zod_1.z.boolean().optional(),
});
exports.router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { workspaceId, q } = req.query;
        const docs = await prisma_1.prisma.document.findMany({
            where: {
                workspaceId,
                isArchived: false,
                ...(q
                    ? {
                        OR: [
                            { title: { contains: q, mode: 'insensitive' } },
                            { content: { contains: q, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, source: true, externalId: true, externalUrl: true, updatedAt: true, createdBy: true },
        });
        res.json(docs);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    try {
        const { workspaceId, title, content, source, externalId, externalUrl } = req.body;
        const doc = await prisma_1.prisma.document.create({
            data: { workspaceId, title, content: content ?? '', source: source ?? 'internal', externalId, externalUrl, createdBy: req.user.id },
        });
        res.status(201).json(doc);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const doc = await prisma_1.prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
        if (doc.source === 'notion' && doc.externalId) {
            const blocks = await notion_1.notionService.getPage(doc.externalId);
            const content = await notion_1.notionService.blocksToMarkdown(blocks);
            res.json({ ...doc, content });
            return;
        }
        if (doc.source === 'obsidian') {
            res.json({ ...doc, content: null });
            return;
        }
        res.json(doc);
    }
    catch {
        res.status(404).json({ error: 'Not found' });
    }
});
exports.router.patch('/:id', auth_1.requireAuth, (0, validate_1.validate)(updateSchema), async (req, res) => {
    try {
        const { content, ...rest } = req.body;
        const existing = await prisma_1.prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
        if (content !== undefined) {
            await prisma_1.prisma.documentVersion.create({
                data: { documentId: req.params.id, editedBy: req.user.id, content: existing.content },
            });
        }
        const doc = await prisma_1.prisma.document.update({
            where: { id: req.params.id },
            data: { ...rest, ...(content !== undefined ? { content } : {}) },
        });
        res.json(doc);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.get('/:id/versions', auth_1.requireAuth, async (req, res) => {
    try {
        const versions = await prisma_1.prisma.documentVersion.findMany({
            where: { documentId: req.params.id },
            orderBy: { createdAt: 'desc' },
            include: { editor: { select: { id: true, displayName: true } } },
        });
        res.json(versions);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.get('/:id/versions/:vid', auth_1.requireAuth, async (req, res) => {
    try {
        const version = await prisma_1.prisma.documentVersion.findUniqueOrThrow({ where: { id: req.params.vid } });
        res.json(version);
    }
    catch {
        res.status(404).json({ error: 'Not found' });
    }
});
exports.default = exports.router;
//# sourceMappingURL=documents.js.map