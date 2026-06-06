import { Router } from 'express';
import {
  register,
  registerContractor,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  deleteAccount
} from './authController';
import { protect } from '../../core/middleware/authMiddleware';
import { authEmailLimiter, authIpLimiter } from '../../core/middleware/rateLimiter';
import { validateRequest, registerSchema, registerContractorSchema, loginSchema, emailOnlySchema, resetPasswordSchema, verifyEmailSchema } from '../../core/middleware/validateMiddleware';

const router = Router();

// Strategie duală de rate limiting pe endpoint-urile sensibile:
//   1. authEmailLimiter → 10 încercări / 15 min per EMAIL (anti brute-force țintit)
//   2. authIpLimiter   → 50 încercări / 15 min per IP    (anti flood volumetric)
//
// Ordinea contează: emailLimiter primul — respinge mai devreme atacurile țintite.
// IP-ul cu prag mai mare nu penalizează utilizatorii pe WiFi comun (campus, birou).

router.post('/register', authEmailLimiter, authIpLimiter, validateRequest(registerSchema), register);
router.post('/register-contractor', authEmailLimiter, authIpLimiter, validateRequest(registerContractorSchema), registerContractor);
router.post('/login', authEmailLimiter, authIpLimiter, validateRequest(loginSchema), login);

// /refresh nu are email în body → email limiter cade pe IP fallback, deci
// aplicăm doar ipLimiter pentru a evita dubla penalizare per IP
router.post('/refresh', authIpLimiter, refresh);
// forgot-password are email în body → dual limiter ca la login
// reset-password are token în body, nu email → doar ipLimiter
router.post('/forgot-password', authEmailLimiter, authIpLimiter, validateRequest(emailOnlySchema), forgotPassword);
router.post('/reset-password', authIpLimiter, validateRequest(resetPasswordSchema), resetPassword);

// Flow verificare email OTP
router.post('/verify-email', authEmailLimiter, authIpLimiter, validateRequest(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', authIpLimiter, validateRequest(emailOnlySchema), resendVerification);

// /logout nu necesită rate limiting strict
router.post('/logout', logout);

// GDPR: Ștergere cont (necesită autentificare + parolă confirmare)
router.delete('/account', protect, deleteAccount);

export default router;
