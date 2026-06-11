"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPresenceHandlers = registerPresenceHandlers;
const prisma_1 = require("../lib/prisma");
function registerPresenceHandlers(io, socket) {
    prisma_1.prisma.user
        .update({ where: { id: socket.userId }, data: { status: 'online', lastSeenAt: new Date() } })
        .then(() => {
        io.emit('presence:update', { userId: socket.userId, status: 'online' });
    })
        .catch(() => { });
    socket.on('disconnect', () => {
        prisma_1.prisma.user
            .update({ where: { id: socket.userId }, data: { status: 'offline', lastSeenAt: new Date() } })
            .then(() => {
            io.emit('presence:update', { userId: socket.userId, status: 'offline' });
        })
            .catch(() => { });
    });
    socket.on('status:set', async (data) => {
        const allowed = ['online', 'away', 'dnd', 'offline'];
        if (!allowed.includes(data.status))
            return;
        await prisma_1.prisma.user.update({
            where: { id: socket.userId },
            data: { status: data.status, statusText: data.statusText },
        });
        io.emit('presence:update', { userId: socket.userId, status: data.status, statusText: data.statusText });
    });
}
//# sourceMappingURL=presence.js.map