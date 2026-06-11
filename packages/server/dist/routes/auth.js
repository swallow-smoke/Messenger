"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const redis_1 = require("../lib/redis");
const validate_1 = require("../middleware/validate");
const auth_1 = require("../middleware/auth");
exports.router = express_1.default.Router();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    displayName: zod_1.z.string().min(1).max(50),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
function signAccess(id, email) {
    return jsonwebtoken_1.default.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: '15m' });
}
function signRefresh(id) {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}
exports.router.post('/register', (0, validate_1.validate)(registerSchema), async (req, res) => {
    try {
        const { email, password, displayName } = req.body;
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.prisma.user.create({
            data: { email, passwordHash, displayName },
            select: { id: true, email: true, displayName: true, avatarUrl: true },
        });
        const accessToken = signAccess(user.id, user.email);
        const refreshToken = signRefresh(user.id);
        await (0, redis_1.setEx)(`refresh:${user.id}`, 60 * 60 * 24 * 7, refreshToken);
        res.status(201).json({ user, accessToken, refreshToken });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.post('/login', (0, validate_1.validate)(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const accessToken = signAccess(user.id, user.email);
        const refreshToken = signRefresh(user.id);
        await (0, redis_1.setEx)(`refresh:${user.id}`, 60 * 60 * 24 * 7, refreshToken);
        res.json({
            user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
            accessToken,
            refreshToken,
        });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(400).json({ error: 'Missing refresh token' });
            return;
        }
        const payload = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const stored = await (0, redis_1.getKey)(`refresh:${payload.id}`);
        if (stored !== refreshToken) {
            res.status(401).json({ error: 'Token revoked' });
            return;
        }
        const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: payload.id } });
        const newAccess = signAccess(user.id, user.email);
        const newRefresh = signRefresh(user.id);
        await (0, redis_1.setEx)(`refresh:${user.id}`, 60 * 60 * 24 * 7, newRefresh);
        res.json({ accessToken: newAccess, refreshToken: newRefresh });
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});
exports.router.post('/logout', auth_1.requireAuth, async (req, res) => {
    try {
        await (0, redis_1.delKey)(`refresh:${req.user.id}`);
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.router.get('/me', auth_1.requireAuth, async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUniqueOrThrow({
            where: { id: req.user.id },
            select: { id: true, email: true, displayName: true, avatarUrl: true, status: true, statusText: true },
        });
        res.json(user);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = exports.router;
//# sourceMappingURL=auth.js.map