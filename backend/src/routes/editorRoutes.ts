import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  getLatestSnapshot,
  publishSnapshot,
  deleteSnapshot,
  explainConformity,
} from '../controllers/editorController';

const router = Router();

// Toate rutele editorului necesită autentificare
router.use(protect);

// Snapshots CRUD
router.post('/snapshots', createSnapshot);
router.get('/snapshots/:projectId', listSnapshots);
router.get('/snapshots/single/:id', getSnapshot);
router.get('/latest/:projectId', getLatestSnapshot);
router.patch('/snapshots/:id/publish', publishSnapshot);
router.delete('/snapshots/:id', deleteSnapshot);

// AI Conformitate — SSE stream
router.post('/explain-conformity', explainConformity);

export default router;
