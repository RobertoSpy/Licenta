/**
 * backend/src/modules/market/marketRoutes.ts
 *
 * Rute Market Intelligence — toate protejate cu middleware `protect`.
 */

import { Router } from 'express';
import { protect } from '../../core/middleware/authMiddleware';
import { marketController } from './marketController';

const router = Router();

// GET /api/market/history — toate punctele CNS107D (pentru grafice)
router.get('/history', protect, marketController.getHistory);

// GET /api/market/forecast — prognoze AI 2027 / 2028 (cu cache 30 zile)
router.get('/forecast', protect, marketController.getForecast);

// GET /api/market/summary — rezumat compact pentru chat agent financiar
router.get('/summary', protect, marketController.getSummary);

export default router;
