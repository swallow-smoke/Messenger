"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMessageHandlers = registerMessageHandlers;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const redis_1 = require("../lib/redis");
const sendSchema = zod_1.z.object({
    contextType: zod_1.z.enum(['channel', 'dm']),
    contextId: zod_1.z.string().uuid(),
    content: zod_1.z.string().min(1),
    parentId: zod_1.z.string().uuid().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
function registerMessageHandlers(io, socket) {
    socket.on('channel:join', (channelId) => {
        socket.join(channelId);
    });
    socket.on('channel:leave', (channelId) => {
        socket.leave(channelId);
    });
    socket.on('message:send', async (data, ack) => {
        try {
            const parsed = sendSchema.parse(data);
            const message = await prisma_1.prisma.message.create({
                data: {
                    contextType: parsed.contextType,
                    contextId: parsed.contextId,
                    senderId: socket.userId,
                    content: parsed.content,
                    parentId: parsed.parentId,
                    metadata: (parsed.metadata ?? {}),
                },
                include: {
                    sender: { select: { id: true, displayName: true, avatarUrl: true } },
                    attachments: true,
                    reactions: true,
                },
            });
            io.to(parsed.contextId).emit('message:new', message);
            ack?.({ ok: true, message });
        }
        catch {
            ack?.({ ok: false, error: 'Failed to send message' });
        }
    });
    socket.on('typing:start', async (data) => {
        const key = `typing:${data.contextId}:${socket.userId}`;
        await redis_1.redis.setex(key, 5, '1');
        socket.to(data.contextId).emit('typing:update', { userId: socket.userId, isTyping: true });
    });
    socket.on('typing:stop', async (data) => {
        const key = `typing:${data.contextId}:${socket.userId}`;
        await redis_1.redis.del(key);
        socket.to(data.contextId).emit('typing:update', { userId: socket.userId, isTyping: false });
    });
}
//# sourceMappingURL=message.js.map