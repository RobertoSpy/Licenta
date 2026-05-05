import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// POST /api/ai/chat — Chat RAG+CAG cu streaming SSE (protejat)
router.post('/chat', protect, aiController.chatStream);

// POST /api/ai/summarize — Rezumare conversație (protejat, non-streaming)
router.post('/summarize', protect, aiController.summarizeConversation);

export default router;
