import { Router } from 'express';
import { aiController, validateMaterialOverride } from './aiController';
import { protect } from '../../core/middleware/authMiddleware';
import { tenantGuard } from '../../core/middleware/tenantGuard';
import { validateRequest, chatSchema, summarizeConversationSchema, saveSummarySchema, suggestRoomsSchema } from '../../core/middleware/validateMiddleware';

const router = Router();

// POST /api/ai/chat — Chat RAG+CAG cu streaming SSE
// Nu are projectId propriu în params — contextul vine din body ca string pre-construit de frontend
router.post('/chat', protect, validateRequest(chatSchema), aiController.chatStream);

// GET /api/ai/explain-material?base=x&alt=y  (legacy)
router.get('/explain-material', protect, aiController.explainMaterial);

// POST /api/ai/explain-material  (full-context with projectId + material codes)
router.post('/explain-material', protect, aiController.explainMaterial);

// GET /api/ai/explain-material/:materialId
router.get('/explain-material/:materialId', protect, aiController.explainMaterialById);

// POST /api/ai/summarize — Rezumare conversație (non-streaming)
router.post('/summarize', protect, validateRequest(summarizeConversationSchema), aiController.summarizeConversation);

// GET /api/ai/summary/:projectId?phase=...&screen=... — citire rezumat din DB
// tenantGuard extrage projectId din req.params.projectId
router.get('/summary/:projectId', protect, tenantGuard, aiController.getSummary);

// POST /api/ai/summary — salvare/actualizare rezumat în DB
// tenantGuard extrage projectId din req.body.projectId
router.post('/summary', protect, validateRequest(saveSummarySchema), tenantGuard, aiController.saveSummary);

// POST /api/ai/suggest-rooms — generare program funcțional AI (listă camere + weightRatio)
// tenantGuard extrage projectId din req.body.projectId
router.post('/suggest-rooms', protect, validateRequest(suggestRoomsSchema), tenantGuard, aiController.suggestRooms);

// POST /api/ai/validate-override — AI validează conformitatea normativă a unui material alternativ (SSE)
// Nu necesită tenantGuard — contextul proiectului vine în body ca string pre-construit
router.post('/validate-override', protect, validateMaterialOverride);

export default router;
