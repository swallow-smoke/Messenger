"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("../lib/redis");
const message_1 = require("./message");
const presence_1 = require("./presence");
function initSocket(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
    });
    io.adapter((0, redis_adapter_1.createAdapter)(redis_1.redis, redis_1.redisSub));
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            next(new Error('Missing token'));
            return;
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.userId = payload.id;
            next();
        }
        catch {
            next(new Error('Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        (0, message_1.registerMessageHandlers)(io, socket);
        (0, presence_1.registerPresenceHandlers)(io, socket);
    });
    return io;
}
//# sourceMappingURL=index.js.map