import { Router } from 'express';
import { register, login, refresh, logout, forgotPassword, resetPassword } from '../controllers/authController';
import { authEmailLimiter, authIpLimiter } from '../middleware/rateLimiter';
import { validateRequest, registerSchema, loginSchema, emailOnlySchema, resetPasswordSchema } from '../middleware/validateMiddleware';

const router = Router();

// Strategie duală de rate limiting pe endpoint-urile sensibile:
//   1. authEmailLimiter → 10 încercări / 15 min per EMAIL (anti brute-force țintit)
//   2. authIpLimiter   → 50 încercări / 15 min per IP    (anti flood volumetric)
//
// Ordinea contează: emailLimiter primul — respinge mai devreme atacurile țintite.
// IP-ul cu prag mai mare nu penalizează utilizatorii pe WiFi comun (campus, birou).

router.post('/register', authEmailLimiter, authIpLimiter, validateRequest(registerSchema), register);
router.post('/login', authEmailLimiter, authIpLimiter, validateRequest(loginSchema), login);

// /refresh nu are email în body → email limiter cade pe IP fallback, deci
// aplicăm doar ipLimiter pentru a evita dubla penalizare per IP
router.post('/refresh', authIpLimiter, refresh);
// forgot-password are email în body → dual limiter ca la login
// reset-password are token în body, nu email → doar ipLimiter
router.post('/forgot-password', authEmailLimiter, authIpLimiter, validateRequest(emailOnlySchema), forgotPassword);
router.post('/reset-password', authIpLimiter, validateRequest(resetPasswordSchema), resetPassword);

// /logout nu necesită rate limiting strict
router.post('/logout', logout);

export default router;
