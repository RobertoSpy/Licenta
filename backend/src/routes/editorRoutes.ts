import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { tenantGuard } from '../middleware/tenantGuard';
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  getLatestSnapshot,
  publishSnapshot,
  deleteSnapshot,
  validateConformity,
  explainConformity,
  generateLayout,
} from '../controllers/editorController';

const router = Router();

// Toate rutele editorului necesită autentificare
router.use(protect);

// Snapshots CRUD
router.post('/snapshots', tenantGuard, createSnapshot);
router.get('/snapshots/:projectId', tenantGuard, listSnapshots);
router.get('/snapshots/single/:id', getSnapshot);
router.get('/latest/:projectId', tenantGuard, getLatestSnapshot);
router.patch('/snapshots/:id/publish', tenantGuard, publishSnapshot);
router.delete('/snapshots/:id', deleteSnapshot);

// AI Conformitate — SSE stream
router.post('/validate-conformity', validateConformity);
router.post('/explain-conformity', explainConformity);

// AI Autogenerare Layout
router.post('/generate-layout', tenantGuard, generateLayout);

export default router;
