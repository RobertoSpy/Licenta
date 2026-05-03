import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Global rate limiter — se aplică pe toate rutele.
 * Scopul: protecție DDoS / brute-force înainte de orice business logic.
 *
 * Valorile sunt conservatoare pentru development; în producție le poți
 * reduce sau extrage din env vars.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 200,                  // maxim 200 request-uri per IP per fereastră
  standardHeaders: true,     // Returnează header-ele `RateLimit-*` (RFC 6585)
  legacyHeaders: false,      // Dezactivează header-ele `X-RateLimit-*` (deprecated)
  message: {
    status: 429,
    message: 'Prea multe cereri. Încearcă din nou mai târziu.',
  },
});

/**
 * Limiter PER EMAIL — prima linie de apărare împotriva brute-force țintit.
 *
 * Problemă rezolvată: limitarea per-IP penalizează toți utilizatorii
 * aflați pe același WiFi / NAT (ex: campus, birou, CGNAT ISP).
 *
 * Soluție: cheie = email normalizat din body → fiecare cont are propriul
 * contor, indiferent de câți utilizatori împart același IP public.
 *
 * Limită: 10 încercări per email per 15 minute.
 * Fallback: dacă email lipsește din body (request malformat), cade pe IP.
 *
 * IMPORTANT: `express.json()` trebuie să ruleze ÎNAINTE de acest middleware
 * (garantat de ordinea din index.ts) pentru ca `req.body.email` să fie disponibil.
 */
export const authEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 încercări per email — prag strict anti brute-force
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Normalizare email: lowercase + trim → evită bypass prin variații de case
    const email = req.body?.email;
    if (email && typeof email === 'string') {
      return `email:${email.toLowerCase().trim()}`;
    }
    // Fallback pe IP dacă emailul lipsește (request malformat / endpoint /refresh)
    return `ip:${req.ip}`;
  },
  message: {
    status: 429,
    message: 'Prea multe încercări pentru acest cont. Încearcă din nou în 15 minute.',
  },
});

/**
 * Limiter PER IP — a doua linie de apărare, anti-flood volumetric.
 *
 * Problemă rezolvată: un atacator poate enumera mii de emailuri diferite
 * dintr-un singur IP, eludând limiterul per-email.
 *
 * Soluție: prag mai mare decât emailLimiter (50 vs 10) pentru a nu bloca
 * utilizatori legitimi pe WiFi comun, dar suficient pentru a detecta flood.
 *
 * Cele două limitere se aplică în serie în authRoutes.ts:
 *   authEmailLimiter → authIpLimiter → handler
 */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 request-uri per IP — tolerant pentru WiFi comun
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => `ip:${req.ip}`,
  message: {
    status: 429,
    message: 'Prea multe cereri de la această rețea. Încearcă din nou în 15 minute.',
  },
});
