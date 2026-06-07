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

const methodNotAllowed = (req: any, res: any) => res.status(405).json({ message: 'Method Not Allowed' });

router.post(
  '/plan-pdf/:projectId',
  tenantGuard,
  exportController.generatePlanPdf
);
router.all('/plan-pdf/:projectId', methodNotAllowed);

router.post(
  '/contractor-pdf/:quoteId',
  exportController.generateContractorPdf
);
router.all('/contractor-pdf/:quoteId', methodNotAllowed);

export default router;
