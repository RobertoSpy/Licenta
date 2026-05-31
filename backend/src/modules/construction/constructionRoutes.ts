import { Router } from 'express';
import { getPhases, completePhase } from './constructionController';
import { protect } from '../../core/middleware/authMiddleware';

const router = Router();

router.use(protect);

router.get('/:projectId', getPhases);
router.patch('/:projectId/phase/:phaseOrder/complete', completePhase);

export default router;
