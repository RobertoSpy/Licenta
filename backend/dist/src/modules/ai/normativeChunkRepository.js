"use strict";
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
exports.normativeChunkRepository = void 0;
const prisma_1 = require("../../lib/prisma");
exports.normativeChunkRepository = {
    /** Căutare globală (fără filtru agent) — fallback general */
    findSimilar(vectorStr, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.$queryRawUnsafe(`
      SELECT "source", "chapter", "content", "agent", "status", "applicability",
             1 - ("embedding" <=> $1::vector) as similarity
      FROM "NormativeChunk"
      WHERE "status" != 'abrogat'
      ORDER BY similarity DESC
      LIMIT $2
    `, vectorStr, limit);
        });
    },
    /**
     * Căutare filtrată pe agent — izolează contextul RAG per domeniu.
     * Exclude automat normativele cu status 'abrogat'.
     *
     * agent = 'geotehnic' | 'seismic' | 'legal' | 'structural' | 'materiale' | 'deviz'
     */
    findSimilarByAgent(vectorStr, limit, agent) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.$queryRawUnsafe(`
      SELECT "source", "chapter", "content", "agent", "status", "applicability",
             1 - ("embedding" <=> $1::vector) as similarity
      FROM "NormativeChunk"
      WHERE "agent" = $3
        AND "status" != 'abrogat'
      ORDER BY similarity DESC
      LIMIT $2
    `, vectorStr, limit, agent);
        });
    },
    /** Statistici pe agenți — util pentru debugging și health-check */
    countByAgent() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.$queryRaw `
      SELECT agent, COUNT(*) as count
      FROM "NormativeChunk"
      GROUP BY agent
      ORDER BY count DESC
    `;
        });
    },
    /** Preluarea fragmentelor finale după IDs */
    findChunksByIds(ids) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.normativeChunk.findMany({
                where: { id: { in: ids } },
            });
        });
    }
};
