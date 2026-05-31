import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

// Set up Redis client
let redisClient: Redis | undefined;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  redisClient.on('error', (err: any) => console.error('[Redis] Rate Limiter Error:', err));
  console.log('[Redis] Rate Limiter connected.');
} else {
  console.log('[Redis] REDIS_URL not set. Falling back to memory store for rate limiting.');
}

const createRedisStore = (prefix: string) => {
  if (!redisClient) return undefined;
  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.call(args[0], ...args.slice(1)) as any,
    prefix: prefix,
  });
};

/**
 * Global rate limiter — se aplică pe toate rutele.
 * Scopul: protecție DDoS / brute-force înainte de orice business logic.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 200,                  // maxim 200 request-uri per IP per fereastră
  standardHeaders: true,     // Returnează header-ele `RateLimit-*` (RFC 6585)
  legacyHeaders: false,      // Dezactivează header-ele `X-RateLimit-*` (deprecated)
  store: createRedisStore('rl-global:'), // Folosește RedisStore dacă e disponibil, altfel memory (default)
  message: {
    status: 429,
    message: 'Prea multe cereri. Încearcă din nou mai târziu.',
  },
});

/**
 * Limiter PER EMAIL — prima linie de apărare împotriva brute-force țintit.
 */
export const authEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 încercări per email — prag strict anti brute-force
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Dezactivează toate validările stricte din v8 (inclusiv IPv6)
  store: createRedisStore('rl-email:'),
  keyGenerator: (req: Request): string => {
    // Normalizare email: lowercase + trim → evită bypass prin variații de case
    const email = req.body?.email;
    if (email && typeof email === 'string') {
      return `email:${email.toLowerCase().trim()}`;
    }
    // Fallback pe IP dacă emailul lipsește
    return `ip:${req.ip?.replace(/:([^:]*)$/, '') || 'unknown'}`;
  },
  message: {
    status: 429,
    message: 'Prea multe încercări pentru acest cont. Încearcă din nou în 15 minute.',
  },
});

/**
 * Limiter PER IP — a doua linie de apărare, anti-flood volumetric.
 */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 request-uri per IP — tolerant pentru WiFi comun
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl-ip:'),
  message: {
    status: 429,
    message: 'Prea multe cereri de la această rețea. Încearcă din nou în 15 minute.',
  },
});

