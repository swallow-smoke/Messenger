"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const notion_1 = require("../services/notion");
const router = express_1.default.Router();
const CIPHER_KEY = Buffer.from((process.env.JWT_SECRET ?? 'default-secret-32-chars-padding!!').padEnd(32).slice(0, 32));
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', CIPHER_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}
function decrypt(text) {
    const [ivHex, encHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', CIPHER_KEY, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
function encryptConfig(config) {
    const result = {};
    for (const [k, v] of Object.entries(config)) {
        result[k] = typeof v === 'string' ? encrypt(v) : v;
    }
    return result;
}
function decryptConfig(config) {
    const result = {};
    for (const [k, v] of Object.entries(config)) {
        if (typeof v === 'string' && v.includes(':')) {
            try {
                result[k] = decrypt(v);
            }
            catch {
                result[k] = v;
            }
        }
        else {
            result[k] = v;
        }
    }
    return result;
}
const createSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['notion', 'obsidian', 'github_actions', 'jenkins', 'custom_ci']),
    name: zod_1.z.string().min(1),
    config: zod_1.z.record(zod_1.z.unknown()),
});
router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    try {
        const { workspaceId, type, name, config } = req.body;
        const integration = await prisma_1.prisma.integration.create({
            data: { workspaceId, type, name, config: encryptConfig(config), createdBy: req.user.id },
        });
        res.status(201).json({ ...integration, config: decryptConfig(integration.config) });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const integrations = await prisma_1.prisma.integration.findMany({ where: { workspaceId } });
        res.json(integrations.map((i) => ({ ...i, config: decryptConfig(i.config) })));
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        await prisma_1.prisma.integration.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/notion/search', auth_1.requireAuth, async (req, res) => {
    try {
        const { q, workspaceId } = req.query;
        const integration = await prisma_1.prisma.integration.findFirst({ where: { workspaceId, type: 'notion', isActive: true } });
        if (!integration) {
            res.status(404).json({ error: 'Notion not configured' });
            return;
        }
        const config = decryptConfig(integration.config);
        const results = await notion_1.notionService.search(q, config.access_token);
        res.json(results);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/notion/page/:pageId', auth_1.requireAuth, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const integration = await prisma_1.prisma.integration.findFirst({ where: { workspaceId, type: 'notion', isActive: true } });
        if (!integration) {
            res.status(404).json({ error: 'Notion not configured' });
            return;
        }
        const config = decryptConfig(integration.config);
        const blocks = await notion_1.notionService.getPage(req.params.pageId, config.access_token);
        const markdown = await notion_1.notionService.blocksToMarkdown(blocks);
        res.json({ markdown });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=integrations.js.map