import Redis from 'ioredis';

let redisClient: Redis | undefined;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  redisClient.on('error', (err: any) => console.error('[Redis] Error:', err));
  console.log('[Redis] Connected.');
} else {
  console.log('[Redis] REDIS_URL not set. Redis disabled.');
}

export { redisClient };
