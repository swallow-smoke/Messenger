import express, { type Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { notionService } from '../services/notion';

const router: Router = express.Router();

const CIPHER_KEY = Buffer.from(
  (process.env.JWT_SECRET ?? 'default-secret-32-chars-padding!!').padEnd(32).slice(0, 32)
);

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', CIPHER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(text: string): string {
  const [ivHex, encHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', CIPHER_KEY, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    result[k] = typeof v === 'string' ? encrypt(v) : v;
  }
  return result;
}

function decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string' && v.includes(':')) {
      try { result[k] = decrypt(v); } catch { result[k] = v; }
    } else {
      result[k] = v;
    }
  }
  return result;
}

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  type: z.enum(['notion', 'obsidian', 'github_actions', 'jenkins', 'custom_ci']),
  name: z.string().min(1),
  config: z.record(z.unknown()),
});

router.post('/', requireAuth, validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, type, name, config } = req.body as z.infer<typeof createSchema>;
    const integration = await prisma.integration.create({
      data: { workspaceId, type, name, config: encryptConfig(config) as InputJsonValue, createdBy: req.user!.id },
    });
    res.status(201).json({ ...integration, config: decryptConfig(integration.config as Record<string, unknown>) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.query as { workspaceId: string };
    const integrations = await prisma.integration.findMany({ where: { workspaceId } });
    res.json(integrations.map((i: any) => ({ ...i, config: decryptConfig(i.config as Record<string, unknown>) })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.integration.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/notion/search', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { q, workspaceId } = req.query as { q: string; workspaceId: string };
    const integration = await prisma.integration.findFirst({ where: { workspaceId, type: 'notion', isActive: true } });
    if (!integration) { res.status(404).json({ error: 'Notion not configured' }); return; }
    const config = decryptConfig(integration.config as Record<string, unknown>);
    const results = await notionService.search(q, config.access_token as string);
    res.json(results);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/notion/page/:pageId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.query as { workspaceId: string };
    const integration = await prisma.integration.findFirst({ where: { workspaceId, type: 'notion', isActive: true } });
    if (!integration) { res.status(404).json({ error: 'Notion not configured' }); return; }
    const config = decryptConfig(integration.config as Record<string, unknown>);
    const blocks = await notionService.getPage(req.params.pageId, config.access_token as string);
    const markdown = await notionService.blocksToMarkdown(blocks);
    res.json({ markdown });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
