import Redis from 'ioredis';

const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(url);
export const redisSub = new Redis(url);
export const redisPub = new Redis(url);

export async function setEx(key: string, seconds: number, value: string): Promise<void> {
  await redis.setex(key, seconds, value);
}

export async function getKey(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function delKey(key: string): Promise<void> {
  await redis.del(key);
}
