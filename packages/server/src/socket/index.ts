import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { redis, redisSub } from '../lib/redis';
import { registerMessageHandlers } from './message';
import { registerPresenceHandlers } from './presence';

export interface AuthSocket extends Socket {
  userId: string;
}

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.adapter(createAdapter(redis, redisSub));

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) { next(new Error('Missing token')); return; }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
      (socket as AuthSocket).userId = payload.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    registerMessageHandlers(io, socket as AuthSocket);
    registerPresenceHandlers(io, socket as AuthSocket);
  });

  return io;
}
