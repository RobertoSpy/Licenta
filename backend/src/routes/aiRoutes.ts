import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { protect } from '../middleware/authMiddleware';
import { tenantGuard } from '../middleware/tenantGuard';

const router = Router();

// POST /api/ai/chat — Chat RAG+CAG cu streaming SSE
// Nu are projectId propriu în params — contextul vine din body ca string pre-construit de frontend
router.post('/chat', protect, aiController.chatStream);

// POST /api/ai/summarize — Rezumare conversație (non-streaming)
router.post('/summarize', protect, aiController.summarizeConversation);

// GET /api/ai/summary/:projectId?phase=...&screen=... — citire rezumat din DB
// tenantGuard extrage projectId din req.params.projectId
router.get('/summary/:projectId', protect, tenantGuard, aiController.getSummary);

// POST /api/ai/summary — salvare/actualizare rezumat în DB
// tenantGuard extrage projectId din req.body.projectId
router.post('/summary', protect, tenantGuard, aiController.saveSummary);

// POST /api/ai/suggest-rooms — generare program funcțional AI (listă camere + weightRatio)
// tenantGuard extrage projectId din req.body.projectId
router.post('/suggest-rooms', protect, tenantGuard, aiController.suggestRooms);

export default router;
