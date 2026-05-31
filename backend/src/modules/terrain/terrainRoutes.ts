import { Router } from 'express';
import { analyzeLocation } from './terrainController';
import { validateRequest, screen1Schema } from '../../core/middleware/validateMiddleware';

const router = Router();

// Screen 1: GPS -> automatic data
router.post('/analyze-location', validateRequest(screen1Schema), analyzeLocation);

export default router;
