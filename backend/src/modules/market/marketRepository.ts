/**
 * backend/src/modules/market/marketRepository.ts
 *
 * Responsabilitate exclusivă: query-uri Prisma pentru Market Intelligence.
 * Zero logică de business — servește strict ca strat de acces la date.
 */

import { prisma } from '../../lib/prisma';

// ─── Tipuri de răspuns ─────────────────────────────────────────────────────

export interface AnnualAverage {
  year: number;
  avg: number;
}

export const marketRepository = {
  /**
   * Returnează toate punctele pentru o categorie dată, ordonate cronologic.
   * Folosit de marketService pentru grafice și calcule.
   */
  async getByCategory(category: string) {
    return prisma.marketIndexPoint.findMany({
      where: { category },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
  },

  /**
   * Returnează toate punctele din toate categoriile, ordonate cronologic.
   * Folosit pentru construirea payload-ului complet al graficelor.
   */
  async getAll() {
    return prisma.marketIndexPoint.findMany({
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
  },

  /**
   * Calculează media anuală per categorie.
   * Folosit pentru afișarea trendului annual simplu.
   */
  async getAnnualAverages(category: string): Promise<AnnualAverage[]> {
    const points = await prisma.marketIndexPoint.findMany({
      where: { category },
      select: { year: true, indexValue: true },
      orderBy: { year: 'asc' },
    });

    const byYear = new Map<number, number[]>();
    for (const p of points) {
      if (!byYear.has(p.year)) byYear.set(p.year, []);
      byYear.get(p.year)!.push(p.indexValue);
    }

    return Array.from(byYear.entries()).map(([year, values]) => ({
      year,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    }));
  },

  /**
   * Returnează cel mai recent punct disponibil pentru o categorie.
   */
  async getLatestPoint(category: string) {
    return prisma.marketIndexPoint.findFirst({
      where: { category },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  },

  /**
   * Returnează ultimele N puncte (ordine descrescătoare) pentru o categorie.
   * Folosit de algoritmul de regresie liniară.
   */
  async getLastNPoints(category: string, n: number) {
    const points = await prisma.marketIndexPoint.findMany({
      where: { category },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: n,
    });
    return points.reverse(); // cronologic crescător
  },

  // ─── Forecast Cache ─────────────────────────────────────────────────────

  /**
   * Returnează cel mai recent cache valid de prognoză.
   */
  async getLatestForecast() {
    return prisma.marketForecastCache.findFirst({
      where: { isValid: true },
      orderBy: { generatedAt: 'desc' },
    });
  },

  /**
   * Invalidează toate cache-urile existente și inserează unul nou.
   * Garantează că există întotdeauna maxim un cache valid.
   */
  async upsertForecast(forecastJson: string, modelUsed: string) {
    return prisma.$transaction(async (tx) => {
      // Invalidăm cache-urile vechi
      await tx.marketForecastCache.updateMany({
        where: { isValid: true },
        data: { isValid: false },
      });

      // Creăm noul cache
      return tx.marketForecastCache.create({
        data: { forecastJson, modelUsed, isValid: true },
      });
    });
  },
};
