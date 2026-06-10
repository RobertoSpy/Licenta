import { Router } from 'express';
import { protect } from '../../core/middleware/authMiddleware';
import { tenantGuard } from '../../core/middleware/tenantGuard';
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  getLatestSnapshot,
  publishSnapshot,
  publishLatestSnapshot,
  deleteSnapshot,
  validateConformity,
  explainConformity,
  generateLayout,
  generateConfiguratorLayout,
} from './editorController';
import { validateRequest, createSnapshotSchema, validateConformitySchema, explainConformitySchema } from '../../core/middleware/validateMiddleware';

const router = Router();

// Toate rutele editorului necesită autentificare
router.use(protect);

// Snapshots CRUD
router.post('/snapshots', validateRequest(createSnapshotSchema), tenantGuard, createSnapshot);
router.get('/snapshots/:projectId', tenantGuard, listSnapshots);
router.get('/snapshots/single/:id', getSnapshot);
router.get('/latest/:projectId', tenantGuard, getLatestSnapshot);
router.patch('/snapshots/:id/publish', tenantGuard, publishSnapshot);
router.patch('/latest/:projectId/publish', tenantGuard, publishLatestSnapshot);
router.delete('/snapshots/:id', deleteSnapshot);

// AI Conformitate — SSE stream
router.post('/validate-conformity', validateRequest(validateConformitySchema), validateConformity);
router.post('/explain-conformity', validateRequest(explainConformitySchema), explainConformity);

// AI Autogenerare Layout
router.post('/generate-layout', tenantGuard, generateLayout);
router.post('/generate-configurator-layout', tenantGuard, generateConfiguratorLayout);

export default router;
