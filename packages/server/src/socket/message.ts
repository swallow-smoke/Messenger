import { Server } from 'socket.io';
import { z } from 'zod';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import type { AuthSocket } from './index';

const sendSchema = z.object({
  contextType: z.enum(['channel', 'dm']),
  contextId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional().nullable(),
  clientTempId: z.string().optional(),
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
      const { clientTempId, ...messageData } = parsed;

      type RawAttachment = {
        file_url: string;
        thumbnail_url?: string | null;
        file_name: string;
        mime_type: string;
        file_size: number;
      };
      const rawAttachments = ((parsed.metadata?.attachments ?? []) as RawAttachment[]);

      const message = await prisma.message.create({
        data: {
          contextType: messageData.contextType,
          contextId: messageData.contextId,
          senderId: socket.userId,
          content: messageData.content,
          parentId: messageData.parentId,
          metadata: (messageData.metadata ?? {}) as InputJsonValue,
          ...(rawAttachments.length > 0 && {
            attachments: {
              create: rawAttachments.map((a) => ({
                fileUrl: a.file_url,
                fileName: a.file_name,
                mimeType: a.mime_type,
                fileSize: BigInt(Math.round(a.file_size)),
                thumbnailUrl: a.thumbnail_url ?? null,
              })),
            },
          }),
        },
        include: {
          sender: { select: { id: true, displayName: true, avatarUrl: true } },
          attachments: true,
          reactions: true,
        },
      });

      const plainMessage = {
        ...message,
        attachments: message.attachments.map((a) => ({ ...a, fileSize: Number(a.fileSize) })),
        clientTempId,
      };
      io.to(parsed.contextId).emit('message:new', plainMessage);
      ack?.({ ok: true, message: plainMessage });
    } catch (err) {
      console.error('message:send error', err);
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
