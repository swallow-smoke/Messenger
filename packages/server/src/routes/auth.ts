import express, { type Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { setEx, getKey, delKey } from '../lib/redis';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const router: Router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  status: z.enum(['online', 'away', 'dnd', 'offline']).optional(),
  statusText: z.string().max(100).nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

function signAccess(id: string, email: string): string {
  return jwt.sign({ id, email }, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

function signRefresh(id: string): string {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
}

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body as z.infer<typeof registerSchema>;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
    const accessToken = signAccess(user.id, user.email);
    const refreshToken = signRefresh(user.id);
    await setEx(`refresh:${user.id}`, 60 * 60 * 24 * 7, refreshToken);
    res.status(201).json({ user, accessToken, refreshToken });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const accessToken = signAccess(user.id, user.email);
    const refreshToken = signRefresh(user.id);
    await setEx(`refresh:${user.id}`, 60 * 60 * 24 * 7, refreshToken);
    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, status: user.status, statusText: user.statusText },
      accessToken,
      refreshToken,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) { res.status(400).json({ error: 'Missing refresh token' }); return; }
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string };
    const stored = await getKey(`refresh:${payload.id}`);
    if (stored !== refreshToken) { res.status(401).json({ error: 'Token revoked' }); return; }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.id } });
    const newAccess = signAccess(user.id, user.email);
    const newRefresh = signRefresh(user.id);
    await setEx(`refresh:${user.id}`, 60 * 60 * 24 * 7, newRefresh);
    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await delKey(`refresh:${req.user!.id}`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { id: true, email: true, displayName: true, avatarUrl: true, status: true, statusText: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/me', requireAuth, validate(updateMeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body as z.infer<typeof updateMeSchema>;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.statusText !== undefined ? { statusText: data.statusText } : {}),
      },
      select: { id: true, email: true, displayName: true, avatarUrl: true, status: true, statusText: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-password', requireAuth, validate(changePasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ error: 'Current password is incorrect' }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
