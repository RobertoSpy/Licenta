/**
 * backend/src/modules/market/marketController.ts
 *
 * Controller pentru Market Intelligence — 3 endpoint-uri GET.
 * Toate protejate via middleware `protect` (definit în routes).
 */

import { Request, Response } from 'express';
import { marketService } from './marketService';

export const marketController = {
  /**
   * GET /api/market/history
   * Returnează toate punctele de indice INSSE CNS107D, formatate pentru grafice.
   * Response: { data: ChartDataPoint[] }
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const data = await marketService.getIndexHistory();
      res.json({ data });
    } catch (e: any) {
      console.error('[marketController.getHistory] Eroare:', e.message);
      res.status(500).json({ error: 'Eroare la citirea istoricului de indici.' });
    }
  },

  /**
   * GET /api/market/forecast
   * Returnează prognoza AI pentru 2027 și 2028 (din cache sau generată live).
   * Response: MarketForecastResponse
   */
  async getForecast(req: Request, res: Response): Promise<void> {
    try {
      const forecast = await marketService.getForecast();
      res.json(forecast);
    } catch (e: any) {
      console.error('[marketController.getForecast] Eroare:', e.message);
      res.status(500).json({ error: 'Eroare la generarea prognozei.' });
    }
  },

  /**
   * GET /api/market/summary
   * Returnează rezumatul compact: ultimele valori + YoY + forecast + contextString.
   * Folosit de agentul financiar pentru a construi contextul chat.
   * Response: MarketSummaryResponse
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const summary = await marketService.getSummary();
      res.json(summary);
    } catch (e: any) {
      console.error('[marketController.getSummary] Eroare:', e.message);
      res.status(500).json({ error: 'Eroare la generarea rezumatului pieței.' });
    }
  },
};
