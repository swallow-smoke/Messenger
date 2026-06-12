import { Server } from 'socket.io';
import { prisma } from '../lib/prisma';
import type { AuthSocket } from './index';

export function registerPresenceHandlers(io: Server, socket: AuthSocket): void {
  // Join personal room for targeted events (friend requests, DMs, etc.)
  socket.join(socket.userId);

  prisma.user
    .update({ where: { id: socket.userId }, data: { status: 'online', lastSeenAt: new Date() } })
    .then(() => {
      io.emit('presence:update', { userId: socket.userId, status: 'online' });
    })
    .catch(() => {});

  socket.on('disconnect', () => {
    prisma.user
      .update({ where: { id: socket.userId }, data: { status: 'offline', lastSeenAt: new Date() } })
      .then(() => {
        io.emit('presence:update', { userId: socket.userId, status: 'offline' });
      })
      .catch(() => {});
  });

  socket.on('status:set', async (data: { status: string; statusText?: string }) => {
    const allowed = ['online', 'away', 'dnd', 'offline'];
    if (!allowed.includes(data.status)) return;
    await prisma.user.update({
      where: { id: socket.userId },
      data: { status: data.status as 'online', statusText: data.statusText },
    });
    io.emit('presence:update', { userId: socket.userId, status: data.status, statusText: data.statusText });
  });
}
