import { NormativeChunk } from '@prisma/client';
import { embeddingService } from './embeddingService';
import { AgentType, AGENT_SOURCES_BY_PURPOSE, BuildingPurpose } from '../../../data/normative-registry';

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

import { prisma } from '../../../lib/prisma';

export async function searchHybrid(
  question: string,
  agent: AgentType,
  limit: number = 5,
  sourcesOverride?: string[],
  buildingPurpose: BuildingPurpose = 'residential'
): Promise<NormativeChunk[]> {
  
  const allowedSources = sourcesOverride ?? AGENT_SOURCES_BY_PURPOSE[buildingPurpose][agent];
  // Agenții fără surse configurate (Phase 3: materiale, deviz) nu au chunks în DB
  if (allowedSources.length === 0) {
    console.debug(`[ragService] Agentul "${agent}" nu are surse configurate — skip.`);
    return [];
  }

  // Generează embedding din întrebarea ORIGINALĂ a utilizatorului
  // Dense search e semantic — "sol argilos" găsește chunks cu "argilă", "pământ argilos" etc.
  // Nu ai nevoie de keyword extraction pentru asta
  const questionVectorArray = await embeddingService.embed(question);
  const vectorStr = `[${questionVectorArray.join(',')}]`;

  // Fallback global — caută în tot ce e indexat
  const isGeneral = agent === 'general';
  
  const sourcesPgArray = allowedSources.length > 0 ? allowedSources : ['_none_'];

  const hybridSql = isGeneral
    ? `
      WITH dense_search AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY 1 - (embedding <=> $1::vector) DESC) as dense_rank,
               1 - (embedding <=> $1::vector) as dense_score
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
             COALESCE(1.0 / (60 + ss.sparse_rank), 0.0) as similarity,
             ds.dense_score as raw_dense_score
      FROM "NormativeChunk" n
      LEFT JOIN dense_search ds ON n.id = ds.id
      LEFT JOIN sparse_search ss ON n.id = ss.id
      WHERE ds.id IS NOT NULL OR ss.id IS NOT NULL
      ORDER BY similarity DESC
      LIMIT $3
    `
    : `
      WITH dense_search AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY 1 - (embedding <=> $1::vector) DESC) as dense_rank,
               1 - (embedding <=> $1::vector) as dense_score
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
             COALESCE(1.0 / (60 + ss.sparse_rank), 0.0) as similarity,
             ds.dense_score as raw_dense_score
      FROM "NormativeChunk" n
      LEFT JOIN dense_search ds ON n.id = ds.id
      LEFT JOIN sparse_search ss ON n.id = ss.id
      WHERE ds.id IS NOT NULL OR ss.id IS NOT NULL
      ORDER BY similarity DESC
      LIMIT $4
    `;

  const results = isGeneral
    ? await prisma.$queryRawUnsafe<NormativeChunk[]>(hybridSql, vectorStr, sourcesPgArray, limit, question)
    : await prisma.$queryRawUnsafe<NormativeChunk[]>(hybridSql, vectorStr, agent, sourcesPgArray, limit, question);

  // Filtrare post-query pe applicability
  const allowedApplicability: Array<'residential' | 'commercial' | 'mixed'> =
    buildingPurpose === 'residential'
      ? ['residential', 'mixed']
      : buildingPurpose === 'commercial'
      ? ['commercial', 'mixed']
      : ['residential', 'commercial', 'mixed'];

  const finalResults = results.filter(
    r => allowedApplicability.includes(r.applicability as any)
  );

  console.log(`[denseSearch] agent=${agent}: ${finalResults.length} rezultate`);
  finalResults.forEach((chunk: any, i: number) => {
    console.log(`  [${i+1}] source="${chunk.source}" RRF=${chunk.similarity?.toFixed(3)} (CosSim=${chunk.raw_dense_score?.toFixed(3)}) | "${chunk.content.slice(0, 120).replace(/\n/g, ' ')}..."`);
  });
  return finalResults;
}

export async function searchMaterialsHybrid(
  question: string,
  limit: number = 3
): Promise<any[]> {
  const questionVectorArray = await embeddingService.embed(question);
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

  const results = await prisma.$queryRawUnsafe<any[]>(hybridSql, vectorStr, limit, question);
  return results;
}

// ─────────────────────────────────────────────────────────────────
// EXPORT OBJECT — interfața legacy pentru compatibilitate cu
// orice caller care importă `ragService.searchRelevantChunks`
// ─────────────────────────────────────────────────────────────────

export const ragService = {
  /**
   * Fallback general — hybrid search fără filtru de agent.
   * Caută în toate normativele indexate.
   */
  async searchRelevantChunks(question: string, limit: number = 3): Promise<string> {
    try {
      const chunks = await searchHybrid(question, 'general', limit, undefined, 'mixed');

      if (!chunks || chunks.length === 0) {
        return 'Nu am găsit informații relevante în normativele indexate.';
      }

      let contextStr = 'Fragmente legislative extrase:\n';
      chunks.forEach(r => {
        contextStr += `\n[Sursa: ${r.source} | Capitol: ${r.chapter}]\n${r.content}\n`;
      });
      return contextStr;
    } catch (error) {
      console.error('[ragService] Eroare la hybrid search:', error);
      return 'Serviciul RAG întâmpină probleme de conectivitate.';
    }
  },

  /**
   * Căutare pentru expertul în materiale (RAG materiale).
   */
  async searchRelevantMaterialChunks(question: string, limit: number = 3): Promise<string> {
    try {
      const chunks = await searchMaterialsHybrid(question, limit);
      if (!chunks || chunks.length === 0) return 'Nu am găsit specificații tehnice relevante în baza de date.';
      let contextStr = 'Fișe tehnice materiale:\n';
      chunks.forEach(r => {
        contextStr += `\n[Material: ${r.materialName} | Sursa: ${r.source}]\n${r.content}\n`;
      });
      return contextStr;
    } catch (error) {
      console.error('[ragService] Eroare la searchMaterialsHybrid:', error);
      return 'Serviciul RAG pentru materiale întâmpină probleme.';
    }
  }
};
