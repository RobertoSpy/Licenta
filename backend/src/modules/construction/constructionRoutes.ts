import { Router } from 'express';
import { getPhases, completePhase } from './constructionController';
import { protect } from '../../core/middleware/authMiddleware';
import { tenantGuard } from '../../core/middleware/tenantGuard';

const router = Router();

router.use(protect);

router.get('/:projectId', tenantGuard, getPhases);
router.patch('/:projectId/phase/:phaseOrder/complete', tenantGuard, completePhase);

export default router;
