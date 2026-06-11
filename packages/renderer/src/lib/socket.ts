import { io, Socket } from 'socket.io-client';
import { config } from './config';
import { storage } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(config.wsUrl, {
      autoConnect: false,
      auth: async (cb) => {
        const token = (await storage.get('accessToken')) ?? '';
        cb({ token });
      },
    });
  }
  return socket;
}

export function connect(): void {
  getSocket().connect();
}

export function disconnect(): void {
  getSocket().disconnect();
}

export { socket };
