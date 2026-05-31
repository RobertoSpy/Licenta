import { Request, Response } from 'express';
import { exportService } from './exportService';

export const exportController = {
  async generatePlanPdf(req: Request, res: Response): Promise<void> {
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
      console.error('[exportController] Eroare la generarea PDF:', err);
      res.status(500).json({ error: 'Eroare la generarea PDF. Încearcă din nou.' });
    }
  }
};
