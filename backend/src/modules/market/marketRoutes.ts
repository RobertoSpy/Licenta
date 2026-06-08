import { Router } from 'express';
import { protect } from '../../core/middleware/authMiddleware';
import {
  publishProject,
  getFeed,
  submitQuote,
  getProjectQuotes,
  acceptQuote
} from './marketController';

const router = Router();

// Toate rutele de market necesită autentificare
router.use(protect);

// Rute Client
router.post('/projects/:id/publish', publishProject);
router.get('/projects/:id/quotes', getProjectQuotes);
router.post('/quotes/:quoteId/accept', acceptQuote);

// Rute Constructor
router.get('/projects/feed', getFeed);
router.post('/projects/:id/quotes', submitQuote);

export default router;
