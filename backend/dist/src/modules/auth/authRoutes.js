"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("./authController");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const rateLimiter_1 = require("../../core/middleware/rateLimiter");
const validateMiddleware_1 = require("../../core/middleware/validateMiddleware");
const router = (0, express_1.Router)();
// Strategie duală de rate limiting pe endpoint-urile sensibile:
//   1. authEmailLimiter → 10 încercări / 15 min per EMAIL (anti brute-force țintit)
//   2. authIpLimiter   → 50 încercări / 15 min per IP    (anti flood volumetric)
//
// Ordinea contează: emailLimiter primul — respinge mai devreme atacurile țintite.
// IP-ul cu prag mai mare nu penalizează utilizatorii pe WiFi comun (campus, birou).
router.post('/register', rateLimiter_1.authEmailLimiter, rateLimiter_1.authIpLimiter, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.registerSchema), authController_1.register);
router.post('/register-contractor', rateLimiter_1.authEmailLimiter, rateLimiter_1.authIpLimiter, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.registerContractorSchema), authController_1.registerContractor);
router.post('/login', rateLimiter_1.authEmailLimiter, rateLimiter_1.authIpLimiter, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.loginSchema), authController_1.login);
// /refresh nu are email în body → email limiter cade pe IP fallback, deci
// aplicăm doar ipLimiter pentru a evita dubla penalizare per IP
router.post('/refresh', rateLimiter_1.authIpLimiter, authController_1.refresh);
// forgot-password are email în body → dual limiter ca la login
// reset-password are token în body, nu email → doar ipLimiter
router.post('/forgot-password', rateLimiter_1.authEmailLimiter, rateLimiter_1.authIpLimiter, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.emailOnlySchema), authController_1.forgotPassword);
router.post('/reset-password', rateLimiter_1.authIpLimiter, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.resetPasswordSchema), authController_1.resetPassword);
// Flow verificare email OTP
router.post('/verify-email', rateLimiter_1.authEmailLimiter, rateLimiter_1.authIpLimiter, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.verifyEmailSchema), authController_1.verifyEmail);
router.post('/resend-verification', rateLimiter_1.authIpLimiter, (0, validateMiddleware_1.validateRequest)(validateMiddleware_1.emailOnlySchema), authController_1.resendVerification);
// /logout nu necesită rate limiting strict
router.post('/logout', authController_1.logout);
// GDPR: Ștergere cont (necesită autentificare + parolă confirmare)
router.delete('/account', authMiddleware_1.protect, authController_1.deleteAccount);
// Actualizare profil bază (nume, parolă)
router.put('/profile', authMiddleware_1.protect, authController_1.updateProfile);
exports.default = router;
