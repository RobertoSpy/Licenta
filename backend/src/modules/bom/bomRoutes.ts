import { Router } from 'express';
import { generateBOM, updateMaterialOverride, bomAdvisorChat, getBOMIntro, getBOMPhaseState, confirmBOMPhase } from './bomController';
import { protect } from '../../core/middleware/authMiddleware';
import { tenantGuard } from '../../core/middleware/tenantGuard';

const router = Router();

// Toate rutele de BOM necesită autentificare și ownership pe proiect
router.use(protect);
router.use('/:projectId', tenantGuard);

router.post('/:projectId/generate', generateBOM);
router.patch('/:projectId/material', updateMaterialOverride);
router.get('/:projectId/intro', getBOMIntro);
router.get('/:projectId/phase-state', getBOMPhaseState);
router.post('/:projectId/phase-state/confirm', confirmBOMPhase);

// POST /api/bom/:projectId/chat — Asistentul RAG conversațional pentru deviz (SSE)
router.post('/:projectId/chat', bomAdvisorChat);

export default router;
