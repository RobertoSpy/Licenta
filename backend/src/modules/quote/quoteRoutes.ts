import { Router } from 'express';
import { protect } from '../../core/middleware/authMiddleware';
import { requireRole } from '../../core/middleware/roleMiddleware';
import { UserRole } from '@prisma/client';
import { requestQuotes, getClientQuotes, getContractorQuotes, submitQuote, acceptQuote } from './quoteController';

const router = Router();

// Rute pentru CLIENȚI
router.post('/request', protect, requireRole(UserRole.CLIENT), requestQuotes);
router.get('/project/:projectId', protect, requireRole(UserRole.CLIENT), getClientQuotes);
router.post('/:id/accept', protect, requireRole(UserRole.CLIENT), acceptQuote);

// Rute pentru CONSTRUCTORI
router.get('/contractor', protect, requireRole(UserRole.CONTRACTOR), getContractorQuotes);
router.post('/:id/submit', protect, requireRole(UserRole.CONTRACTOR), submitQuote);

export default router;
