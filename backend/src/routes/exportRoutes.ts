// backend/src/routes/exportRoutes.ts
//
// Endpoint-uri export:
//   GET /api/export/plan-pdf/:projectId  → PDF prezentare 2 pagini (Puppeteer)
//
// Nota PNG: exportul PNG se face direct din frontend (Konva Stage.toDataURL)
// fără backend — nicio rută necesară.

import { Router, Request, Response } from 'express';
import { protect } from '../middleware/authMiddleware';
import { tenantGuard } from '../middleware/tenantGuard';
import { exportService } from '../services/exportService';
import { AuthRequest } from '../middleware/authMiddleware';

const router = Router();

router.use(protect);

/**
 * GET /api/export/plan-pdf/:projectId
 *
 * Generează PDF de prezentare cu planul parterului.
 * Body (JSON opțional): { planPngBase64: string } — dacă e absent, PDF-ul va
 *   conține o notă că imaginea nu e disponibilă.
 * Trimite planPngBase64 din frontend (Konva.toDataURL) via POST pentru a evita
 * limitele de URL pentru imagini mari → folosim POST.
 */
router.post(
  '/plan-pdf/:projectId',
  tenantGuard,
  async (req: Request, res: Response): Promise<void> => {
    const projectId = parseInt(req.params['projectId'] as string);
    const { planPngBase64 } = req.body as { planPngBase64?: string };

    if (isNaN(projectId)) {
      res.status(400).json({ error: 'projectId invalid' });
      return;
    }

    try {
      const result = await exportService.generatePlanPdf(
        projectId,
        planPngBase64 ?? null
      );

      if (!result) {
        res.status(404).json({
          error: 'Nu există snapshot publicat pentru acest proiect. Publică mai întâi o versiune a planului.',
        });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.buffer.length);
      res.send(result.buffer);
    } catch (err) {
      console.error('[exportRoutes] Eroare la generarea PDF:', err);
      res.status(500).json({ error: 'Eroare la generarea PDF. Încearcă din nou.' });
    }
  }
);

export default router;
