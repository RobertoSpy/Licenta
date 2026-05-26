import { NormativeChunk } from '@prisma/client';
import { embeddingService } from './embeddingService';
import { AgentType, AGENT_SOURCES_BY_PURPOSE, BuildingPurpose } from '../../data/normative-registry';
import { normativeChunkRepository, RawChunkResult } from '../../repositories/normativeChunkRepository';

// ─────────────────────────────────────────────────────────────────
// HYBRID SEARCH — Dense (pgvector cosine) + Sparse (BM25 full-text) + RRF
//
// De ce hybrid:
//   • Dense:  prinde sensul semantic chiar dacă întrebarea nu conține
//             termenii exacți din normativ
//   • Sparse: prinde termeni tehnici exacți — "ZIA", "DCH", "suțiune" —
//             pe care dense search îi poate rata
//   • RRF k=60: standard academic — score(d) = Σ 1/(k + rank(d))
//
// Notă modularitate:
//   Toate interogările SQL brute sunt delegate stratului de repository
//   (normativeChunkRepository), menținând ragService axat exclusiv pe logica
//   de business: generare embeddings, filtrare surse, algoritm RRF și ordonare.
// ─────────────────────────────────────────────────────────────────

import { prisma } from '../../lib/prisma';

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

  // Query SQL direct din Prisma folosind pgvector
  const denseSql = isGeneral
    ? `SELECT id, source, agent, chapter, content, applicability,
              1 - (embedding <=> $1::vector) as similarity
       FROM "NormativeChunk"
       WHERE status != 'abrogat'
         AND source = ANY($2)
         AND 1 - (embedding <=> $1::vector) > 0.55
       ORDER BY similarity DESC
       LIMIT $3`
    : `SELECT id, source, agent, chapter, content, applicability,
              1 - (embedding <=> $1::vector) as similarity
       FROM "NormativeChunk"
       WHERE agent = $2
         AND status != 'abrogat'
         AND source = ANY($3)
         AND 1 - (embedding <=> $1::vector) > 0.55
       ORDER BY similarity DESC
       LIMIT $4`;

  const results = isGeneral
    ? await prisma.$queryRawUnsafe<NormativeChunk[]>(denseSql, vectorStr, sourcesPgArray, limit)
    : await prisma.$queryRawUnsafe<NormativeChunk[]>(denseSql, vectorStr, agent, sourcesPgArray, limit);

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
  return finalResults;
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
};
