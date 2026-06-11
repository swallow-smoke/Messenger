import { Server } from 'socket.io';
import { z } from 'zod';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import type { AuthSocket } from './index';

const sendSchema = z.object({
  contextType: z.enum(['channel', 'dm']),
  contextId: z.string().uuid(),
  content: z.string().min(1),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export function registerMessageHandlers(io: Server, socket: AuthSocket): void {
  socket.on('channel:join', (channelId: string) => {
    socket.join(channelId);
  });

  socket.on('channel:leave', (channelId: string) => {
    socket.leave(channelId);
  });

  socket.on('message:send', async (data: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = sendSchema.parse(data);
      const message = await prisma.message.create({
        data: {
          contextType: parsed.contextType,
          contextId: parsed.contextId,
          senderId: socket.userId,
          content: parsed.content,
          parentId: parsed.parentId,
          metadata: (parsed.metadata ?? {}) as InputJsonValue,
        },
        include: {
          sender: { select: { id: true, displayName: true, avatarUrl: true } },
          attachments: true,
          reactions: true,
        },
      });
      io.to(parsed.contextId).emit('message:new', message);
      ack?.({ ok: true, message });
    } catch {
      ack?.({ ok: false, error: 'Failed to send message' });
    }
  });

  socket.on('typing:start', async (data: { contextId: string }) => {
    const key = `typing:${data.contextId}:${socket.userId}`;
    await redis.setex(key, 5, '1');
    socket.to(data.contextId).emit('typing:update', { userId: socket.userId, isTyping: true });
  });

  socket.on('typing:stop', async (data: { contextId: string }) => {
    const key = `typing:${data.contextId}:${socket.userId}`;
    await redis.del(key);
    socket.to(data.contextId).emit('typing:update', { userId: socket.userId, isTyping: false });
  });
}
