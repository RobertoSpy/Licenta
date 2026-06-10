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
exports.ragService = void 0;
exports.searchHybrid = searchHybrid;
exports.searchMaterialsHybrid = searchMaterialsHybrid;
const embeddingService_1 = require("./embeddingService");
const normative_registry_1 = require("../../../data/normative-registry");
// ─────────────────────────────────────────────────────────────────
// HYBRID SEARCH — Dense (pgvector cosine) + Sparse (PostgreSQL Full-Text Search ts_rank_cd) + RRF
//
// De ce hybrid:
//   • Dense:  prinde sensul semantic chiar dacă întrebarea nu conține
//             termenii exacți din normativ
//   • Sparse: prinde termeni tehnici exacți — "ZIA", "DCH", "suțiune" —
//             folosind dicționarul 'simple' pentru a evita limitările de flexiune.
//   • RRF k=60: standard academic — score(d) = Σ 1/(k + rank(d))
//
// Notă modularitate:
//   Toate interogările SQL brute sunt delegate stratului de repository
//   (normativeChunkRepository), menținând ragService axat exclusiv pe logica
//   de business: generare embeddings, filtrare surse, algoritm RRF și ordonare.
// ─────────────────────────────────────────────────────────────────
const prisma_1 = require("../../../lib/prisma");
function searchHybrid(question_1, agent_1) {
    return __awaiter(this, arguments, void 0, function* (question, agent, limit = 5, sourcesOverride, buildingPurpose = 'residential') {
        const allowedSources = sourcesOverride !== null && sourcesOverride !== void 0 ? sourcesOverride : normative_registry_1.AGENT_SOURCES_BY_PURPOSE[buildingPurpose][agent];
        // Agenții fără surse configurate (Phase 3: materiale, deviz) nu au chunks în DB
        if (allowedSources.length === 0) {
            console.debug(`[ragService] Agentul "${agent}" nu are surse configurate — skip.`);
            return [];
        }
        // Generează embedding din întrebarea ORIGINALĂ a utilizatorului
        // Dense search e semantic — "sol argilos" găsește chunks cu "argilă", "pământ argilos" etc.
        // Nu ai nevoie de keyword extraction pentru asta
        const questionVectorArray = yield embeddingService_1.embeddingService.embed(question);
        const vectorStr = `[${questionVectorArray.join(',')}]`;
        // Fallback global — caută în tot ce e indexat
        const isGeneral = agent === 'general';
        const sourcesPgArray = allowedSources.length > 0 ? allowedSources : ['_none_'];
        const hybridSql = isGeneral
            ? `
      WITH dense_search AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY 1 - (embedding <=> $1::vector) DESC) as dense_rank
        FROM "NormativeChunk"
        WHERE status != 'abrogat' AND source = ANY($2)
        ORDER BY 1 - (embedding <=> $1::vector) DESC
        LIMIT 20
      ),
      sparse_search AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $4)) DESC) as sparse_rank
        FROM "NormativeChunk"
        WHERE status != 'abrogat' AND source = ANY($2)
          AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $4)
        ORDER BY ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $4)) DESC
        LIMIT 20
      )
      SELECT n.id, n.source, n.agent, n.chapter, n.content, n.applicability,
             COALESCE(1.0 / (60 + ds.dense_rank), 0.0) +
             COALESCE(1.0 / (60 + ss.sparse_rank), 0.0) as similarity
      FROM "NormativeChunk" n
      LEFT JOIN dense_search ds ON n.id = ds.id
      LEFT JOIN sparse_search ss ON n.id = ss.id
      WHERE ds.id IS NOT NULL OR ss.id IS NOT NULL
      ORDER BY similarity DESC
      LIMIT $3
    `
            : `
      WITH dense_search AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY 1 - (embedding <=> $1::vector) DESC) as dense_rank
        FROM "NormativeChunk"
        WHERE agent = $2 AND status != 'abrogat' AND source = ANY($3)
        ORDER BY 1 - (embedding <=> $1::vector) DESC
        LIMIT 20
      ),
      sparse_search AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $5)) DESC) as sparse_rank
        FROM "NormativeChunk"
        WHERE agent = $2 AND status != 'abrogat' AND source = ANY($3)
          AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $5)
        ORDER BY ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $5)) DESC
        LIMIT 20
      )
      SELECT n.id, n.source, n.agent, n.chapter, n.content, n.applicability,
             COALESCE(1.0 / (60 + ds.dense_rank), 0.0) +
             COALESCE(1.0 / (60 + ss.sparse_rank), 0.0) as similarity
      FROM "NormativeChunk" n
      LEFT JOIN dense_search ds ON n.id = ds.id
      LEFT JOIN sparse_search ss ON n.id = ss.id
      WHERE ds.id IS NOT NULL OR ss.id IS NOT NULL
      ORDER BY similarity DESC
      LIMIT $4
    `;
        const results = isGeneral
            ? yield prisma_1.prisma.$queryRawUnsafe(hybridSql, vectorStr, sourcesPgArray, limit, question)
            : yield prisma_1.prisma.$queryRawUnsafe(hybridSql, vectorStr, agent, sourcesPgArray, limit, question);
        // Filtrare post-query pe applicability
        const allowedApplicability = buildingPurpose === 'residential'
            ? ['residential', 'mixed']
            : buildingPurpose === 'commercial'
                ? ['commercial', 'mixed']
                : ['residential', 'commercial', 'mixed'];
        const finalResults = results.filter(r => allowedApplicability.includes(r.applicability));
        console.log(`[denseSearch] agent=${agent}: ${finalResults.length} rezultate`);
        return finalResults;
    });
}
function searchMaterialsHybrid(question_1) {
    return __awaiter(this, arguments, void 0, function* (question, limit = 3) {
        const questionVectorArray = yield embeddingService_1.embeddingService.embed(question);
        const vectorStr = `[${questionVectorArray.join(',')}]`;
        const hybridSql = `
    WITH dense_search AS (
      SELECT mc.id, ROW_NUMBER() OVER (ORDER BY 1 - (mc.embedding <=> $1::vector) DESC) as dense_rank
      FROM "MaterialChunk" mc
      ORDER BY 1 - (mc.embedding <=> $1::vector) DESC
      LIMIT 20
    ),
    sparse_search AS (
      SELECT mc.id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('simple', mc.content), plainto_tsquery('simple', $3)) DESC) as sparse_rank
      FROM "MaterialChunk" mc
      WHERE to_tsvector('simple', mc.content) @@ plainto_tsquery('simple', $3)
      ORDER BY ts_rank_cd(to_tsvector('simple', mc.content), plainto_tsquery('simple', $3)) DESC
      LIMIT 20
    )
    SELECT mc.id, mc.content, mc.source, m.name as "materialName", m."internalCode",
           COALESCE(1.0 / (60 + ds.dense_rank), 0.0) +
           COALESCE(1.0 / (60 + ss.sparse_rank), 0.0) as similarity
    FROM "MaterialChunk" mc
    JOIN "Material" m ON m.id = mc."materialId"
    LEFT JOIN dense_search ds ON mc.id = ds.id
    LEFT JOIN sparse_search ss ON mc.id = ss.id
    WHERE ds.id IS NOT NULL OR ss.id IS NOT NULL
    ORDER BY similarity DESC
    LIMIT $2
  `;
        const results = yield prisma_1.prisma.$queryRawUnsafe(hybridSql, vectorStr, limit, question);
        return results;
    });
}
// ─────────────────────────────────────────────────────────────────
// EXPORT OBJECT — interfața legacy pentru compatibilitate cu
// orice caller care importă `ragService.searchRelevantChunks`
// ─────────────────────────────────────────────────────────────────
exports.ragService = {
    /**
     * Fallback general — hybrid search fără filtru de agent.
     * Caută în toate normativele indexate.
     */
    searchRelevantChunks(question_1) {
        return __awaiter(this, arguments, void 0, function* (question, limit = 3) {
            try {
                const chunks = yield searchHybrid(question, 'general', limit, undefined, 'mixed');
                if (!chunks || chunks.length === 0) {
                    return 'Nu am găsit informații relevante în normativele indexate.';
                }
                let contextStr = 'Fragmente legislative extrase:\n';
                chunks.forEach(r => {
                    contextStr += `\n[Sursa: ${r.source} | Capitol: ${r.chapter}]\n${r.content}\n`;
                });
                return contextStr;
            }
            catch (error) {
                console.error('[ragService] Eroare la hybrid search:', error);
                return 'Serviciul RAG întâmpină probleme de conectivitate.';
            }
        });
    },
    /**
     * Căutare pentru expertul în materiale (RAG materiale).
     */
    searchRelevantMaterialChunks(question_1) {
        return __awaiter(this, arguments, void 0, function* (question, limit = 3) {
            try {
                const chunks = yield searchMaterialsHybrid(question, limit);
                if (!chunks || chunks.length === 0)
                    return 'Nu am găsit specificații tehnice relevante în baza de date.';
                let contextStr = 'Fișe tehnice materiale:\n';
                chunks.forEach(r => {
                    contextStr += `\n[Material: ${r.materialName} | Sursa: ${r.source}]\n${r.content}\n`;
                });
                return contextStr;
            }
            catch (error) {
                console.error('[ragService] Eroare la searchMaterialsHybrid:', error);
                return 'Serviciul RAG pentru materiale întâmpină probleme.';
            }
        });
    }
};
