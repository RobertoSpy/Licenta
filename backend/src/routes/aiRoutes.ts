import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Endpoint de chat RAG+CAG protejat ce returnează text progresiv (SSE)
router.post('/chat', protect, aiController.chatStream);

export default router;
