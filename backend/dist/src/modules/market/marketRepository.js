"use strict";
/**
 * backend/src/modules/market/marketRepository.ts
 *
 * Responsabilitate exclusivă: query-uri Prisma pentru Market Intelligence.
 * Zero logică de business — servește strict ca strat de acces la date.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketRepository = void 0;
const prisma_1 = require("../../lib/prisma");
exports.marketRepository = {
    /**
     * Returnează toate punctele pentru o categorie dată, ordonate cronologic.
     * Folosit de marketService pentru grafice și calcule.
     */
    getByCategory(category) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.marketIndexPoint.findMany({
                where: { category },
                orderBy: [{ year: 'asc' }, { month: 'asc' }],
            });
        });
    },
    /**
     * Returnează toate punctele din toate categoriile, ordonate cronologic.
     * Folosit pentru construirea payload-ului complet al graficelor.
     */
    getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.marketIndexPoint.findMany({
                orderBy: [{ year: 'asc' }, { month: 'asc' }],
            });
        });
    },
    /**
     * Calculează media anuală per categorie.
     * Folosit pentru afișarea trendului annual simplu.
     */
    getAnnualAverages(category) {
        return __awaiter(this, void 0, void 0, function* () {
            const points = yield prisma_1.prisma.marketIndexPoint.findMany({
                where: { category },
                select: { year: true, indexValue: true },
                orderBy: { year: 'asc' },
            });
            const byYear = new Map();
            for (const p of points) {
                if (!byYear.has(p.year))
                    byYear.set(p.year, []);
                byYear.get(p.year).push(p.indexValue);
            }
            return Array.from(byYear.entries()).map(([year, values]) => ({
                year,
                avg: values.reduce((a, b) => a + b, 0) / values.length,
            }));
        });
    },
    /**
     * Returnează cel mai recent punct disponibil pentru o categorie.
     */
    getLatestPoint(category) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.marketIndexPoint.findFirst({
                where: { category },
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
            });
        });
    },
    /**
     * Returnează ultimele N puncte (ordine descrescătoare) pentru o categorie.
     * Folosit de algoritmul de regresie liniară.
     */
    getLastNPoints(category, n) {
        return __awaiter(this, void 0, void 0, function* () {
            const points = yield prisma_1.prisma.marketIndexPoint.findMany({
                where: { category },
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
                take: n,
            });
            return points.reverse(); // cronologic crescător
        });
    },
    // ─── Forecast Cache ─────────────────────────────────────────────────────
    /**
     * Returnează cel mai recent cache valid de prognoză.
     */
    getLatestForecast() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.marketForecastCache.findFirst({
                where: { isValid: true },
                orderBy: { generatedAt: 'desc' },
            });
        });
    },
    /**
     * Invalidează toate cache-urile existente și inserează unul nou.
     * Garantează că există întotdeauna maxim un cache valid.
     */
    upsertForecast(forecastJson, modelUsed) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Invalidăm cache-urile vechi
                yield tx.marketForecastCache.updateMany({
                    where: { isValid: true },
                    data: { isValid: false },
                });
                // Creăm noul cache
                return tx.marketForecastCache.create({
                    data: { forecastJson, modelUsed, isValid: true },
                });
            }));
        });
    },
};
