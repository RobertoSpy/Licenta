import { Router } from 'express';
import { getPhases, completePhase } from '../controllers/constructionController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect);

router.get('/:projectId', getPhases);
router.patch('/:projectId/phase/:phaseOrder/complete', completePhase);

export default router;
