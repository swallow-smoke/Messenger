"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisPub = exports.redisSub = exports.redis = void 0;
exports.setEx = setEx;
exports.getKey = getKey;
exports.delKey = delKey;
const ioredis_1 = __importDefault(require("ioredis"));
const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
exports.redis = new ioredis_1.default(url);
exports.redisSub = new ioredis_1.default(url);
exports.redisPub = new ioredis_1.default(url);
async function setEx(key, seconds, value) {
    await exports.redis.setex(key, seconds, value);
}
async function getKey(key) {
    return exports.redis.get(key);
}
async function delKey(key) {
    await exports.redis.del(key);
}
//# sourceMappingURL=redis.js.map