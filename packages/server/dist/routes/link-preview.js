"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const link_preview_1 = require("../services/link-preview");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            res.status(400).json({ error: 'url required' });
            return;
        }
        const existing = await prisma_1.prisma.linkPreview.findUnique({ where: { url } });
        if (existing && existing.expiresAt > new Date()) {
            res.json(existing);
            return;
        }
        const preview = await (0, link_preview_1.fetchLinkPreview)(url);
        const saved = await prisma_1.prisma.linkPreview.upsert({
            where: { url },
            create: { url, ...preview },
            update: { ...preview, fetchedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        res.json(saved);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=link-preview.js.map