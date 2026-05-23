import { NormativeChunk } from '@prisma/client';
import { embeddingService } from './embeddingService';
import { AgentType, AGENT_SOURCES_BY_PURPOSE } from '../../data/normative-registry';
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

export async function searchHybrid(
  question: string,
  agent: AgentType,
  limit: number = 5,
  sourcesOverride?: string[]
): Promise<NormativeChunk[]> {

  const allowedSources = sourcesOverride ?? AGENT_SOURCES_BY_PURPOSE['residential'][agent];
  // Agenții fără surse configurate (Phase 3: materiale, deviz) nu au chunks în DB
  if (allowedSources.length === 0) {
    console.debug(`[ragService] Agentul "${agent}" nu are surse configurate — skip.`);
    return [];
  }

  const questionVectorArray = await embeddingService.embed(question);
  const vectorStr = `[${questionVectorArray.join(',')}]`;

  // Dacă agentul este 'general', nu filtrăm după agent în SQL
  // (fallback global — caută în tot ce e indexat)
  const isGeneral = agent === 'general';

  // 1. DENSE SEARCH — similaritate semantică (cosine via pgvector)
  const denseResults = await normativeChunkRepository.searchDense(vectorStr, agent, isGeneral);

  // Filtrare post-query pe sources — evită interpolare dinamică de array în SQL
  const denseFiltered = denseResults.filter(r => allowedSources.includes(r.source));

  // 2. SPARSE SEARCH — BM25 via PostgreSQL full-text search
  let sparseFiltered: RawChunkResult[] = [];
  try {
    const sparseResults = await normativeChunkRepository.searchSparse(question, agent, isGeneral);
    sparseFiltered = sparseResults.filter(r => allowedSources.includes(r.source));
  } catch {
    // plainto_tsquery eșuează pe interogări prea scurte sau cu caractere speciale.
    // Fallback silențios — dense-only e suficient în acest caz.
    console.debug(`[ragService] Sparse search eșuat pentru agent="${agent}", fallback pe dense.`);
  }

  if (sparseFiltered.length === 0) {
    console.debug(`[ragService] Sparse: 0 rezultate pentru agent="${agent}".`);
  }

  // 3. RECIPROCAL RANK FUSION (RRF) — k=60 standard academic
  // score(d) = Σ 1/(k + rank(d)), unde suma este peste toate listele de ranking
  const k = 60;
  const scoreMap = new Map<number, number>();

  denseFiltered.forEach((r, rank) => {
    scoreMap.set(r.id, (scoreMap.get(r.id) ?? 0) + 1 / (k + rank + 1));
  });
  sparseFiltered.forEach((r, rank) => {
    scoreMap.set(r.id, (scoreMap.get(r.id) ?? 0) + 1 / (k + rank + 1));
  });

  if (scoreMap.size === 0) return [];

  // Sortare după scor RRF → top `limit`
  const sortedIds = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  // Fetch final tip-safe prin repository
  const finalChunks = await normativeChunkRepository.findChunksByIds(sortedIds);

  // Re-sortare după scor RRF — Prisma nu garantează ordinea din IN clause
  return finalChunks.sort(
    (a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0)
  );
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
      const chunks = await searchHybrid(question, 'general', limit);

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
