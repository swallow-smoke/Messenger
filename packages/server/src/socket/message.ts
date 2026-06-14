import { Server } from 'socket.io';
import { z } from 'zod';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { fetchLinkPreview } from '../services/link-preview';
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

      // Detect @username mentions and resolve to user IDs
      let mentions: string[] = [];
      if (messageData.content.includes('@')) {
        if (messageData.contextType === 'channel') {
          const channel = await prisma.channel.findUnique({
            where: { id: messageData.contextId },
            select: {
              workspace: {
                select: {
                  members: {
                    where: { userId: { not: socket.userId } },
                    select: { userId: true, user: { select: { displayName: true } } },
                  },
                },
              },
            },
          });
          mentions = channel?.workspace.members
            .filter((m) => messageData.content.includes(`@${m.user.displayName}`))
            .map((m) => m.userId) ?? [];
        } else {
          const dmMembers = await prisma.directMember.findMany({
            where: { conversationId: messageData.contextId, userId: { not: socket.userId } },
            select: { userId: true, user: { select: { displayName: true } } },
          });
          mentions = dmMembers
            .filter((m) => messageData.content.includes(`@${m.user.displayName}`))
            .map((m) => m.userId);
        }
      }

      const plainMessage = {
        ...message,
        attachments: message.attachments.map((a) => ({ ...a, fileSize: Number(a.fileSize) })),
        clientTempId,
        mentions,
      };
      io.to(parsed.contextId).emit('message:new', plainMessage);
      ack?.({ ok: true, message: plainMessage });

      // Async link preview — must not block or affect message delivery
      const urlMatch = messageData.content.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
      if (urlMatch) {
        void (async () => {
          try {
            const preview = await fetchLinkPreview(urlMatch[0]);
            if (!preview.title && !preview.description) return;

            const existingMeta = (message.metadata ?? {}) as Record<string, unknown>;
            const updated = await prisma.message.update({
              where: { id: message.id },
              data: {
                metadata: {
                  ...existingMeta,
                  linkPreview: { url: urlMatch[0], ...preview },
                } as InputJsonValue,
              },
              include: {
                sender: { select: { id: true, displayName: true, avatarUrl: true } },
                attachments: true,
                reactions: true,
              },
            });

            const plainUpdated = {
              ...updated,
              attachments: updated.attachments.map((a) => ({ ...a, fileSize: Number(a.fileSize) })),
            };
            io.to(parsed.contextId).emit('message:update', plainUpdated);
          } catch {
            // preview failure must not surface to the user
          }
        })();
      }
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
