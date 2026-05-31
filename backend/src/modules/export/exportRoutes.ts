// backend/src/routes/exportRoutes.ts
//
// Endpoint-uri export:
//   GET /api/export/plan-pdf/:projectId  → PDF prezentare 2 pagini (Puppeteer)
//
// Nota PNG: exportul PNG se face direct din frontend (Konva Stage.toDataURL)
// fără backend — nicio rută necesară.

import { Router } from 'express';
import { protect } from '../../core/middleware/authMiddleware';
import { tenantGuard } from '../../core/middleware/tenantGuard';
import { exportController } from './exportController';

const router = Router();

router.use(protect);

router.post(
  '/plan-pdf/:projectId',
  tenantGuard,
  exportController.generatePlanPdf
);

export default router;
