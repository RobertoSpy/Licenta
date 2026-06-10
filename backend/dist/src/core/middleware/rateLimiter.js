"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authIpLimiter = exports.authEmailLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
const ioredis_1 = __importDefault(require("ioredis"));
// Set up Redis client
let redisClient;
if (process.env.REDIS_URL) {
    redisClient = new ioredis_1.default(process.env.REDIS_URL);
    redisClient.on('error', (err) => console.error('[Redis] Rate Limiter Error:', err));
    console.log('[Redis] Rate Limiter connected.');
}
else {
    console.log('[Redis] REDIS_URL not set. Falling back to memory store for rate limiting.');
}
const createRedisStore = (prefix) => {
    if (!redisClient)
        return undefined;
    return new rate_limit_redis_1.default({
        sendCommand: (...args) => redisClient.call(args[0], ...args.slice(1)),
        prefix: prefix,
    });
};
/**
 * Global rate limiter — se aplică pe toate rutele.
 * Scopul: protecție DDoS / brute-force înainte de orice business logic.
 */
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minute
    max: 200, // maxim 200 request-uri per IP per fereastră
    standardHeaders: true, // Returnează header-ele `RateLimit-*` (RFC 6585)
    legacyHeaders: false, // Dezactivează header-ele `X-RateLimit-*` (deprecated)
    store: createRedisStore('rl-global:'), // Folosește RedisStore dacă e disponibil, altfel memory (default)
    message: {
        status: 429,
        message: 'Prea multe cereri. Încearcă din nou mai târziu.',
    },
});
/**
 * Limiter PER EMAIL — prima linie de apărare împotriva brute-force țintit.
 */
exports.authEmailLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10, // 10 încercări per email — prag strict anti brute-force
    standardHeaders: true,
    legacyHeaders: false,
    validate: false, // Dezactivează toate validările stricte din v8 (inclusiv IPv6)
    store: createRedisStore('rl-email:'),
    keyGenerator: (req) => {
        var _a, _b;
        // Normalizare email: lowercase + trim → evită bypass prin variații de case
        const email = (_a = req.body) === null || _a === void 0 ? void 0 : _a.email;
        if (email && typeof email === 'string') {
            return `email:${email.toLowerCase().trim()}`;
        }
        // Fallback pe IP dacă emailul lipsește
        return `ip:${((_b = req.ip) === null || _b === void 0 ? void 0 : _b.replace(/:([^:]*)$/, '')) || 'unknown'}`;
    },
    message: {
        status: 429,
        message: 'Prea multe încercări pentru acest cont. Încearcă din nou în 15 minute.',
    },
});
/**
 * Limiter PER IP — a doua linie de apărare, anti-flood volumetric.
 */
exports.authIpLimiter = (0, express_rate_limit_1.default)({
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
