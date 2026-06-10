"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../core/middleware/authMiddleware");
const roleMiddleware_1 = require("../../core/middleware/roleMiddleware");
const client_1 = require("@prisma/client");
const quoteController_1 = require("./quoteController");
const router = (0, express_1.Router)();
// Rute pentru CLIENȚI
router.post('/request', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(client_1.UserRole.CLIENT), quoteController_1.requestQuotes);
router.get('/project/:projectId', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(client_1.UserRole.CLIENT), quoteController_1.getClientQuotes);
router.post('/:id/accept', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(client_1.UserRole.CLIENT), quoteController_1.acceptQuote);
// Rute pentru CONSTRUCTORI
router.get('/contractor', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(client_1.UserRole.CONTRACTOR), quoteController_1.getContractorQuotes);
router.post('/submit', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(client_1.UserRole.CONTRACTOR), quoteController_1.submitQuote);
router.post('/:id/submit', authMiddleware_1.protect, (0, roleMiddleware_1.requireRole)(client_1.UserRole.CONTRACTOR), quoteController_1.submitQuote);
exports.default = router;
