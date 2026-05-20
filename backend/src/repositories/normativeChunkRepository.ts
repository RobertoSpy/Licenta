import { NormativeChunk } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface RawChunkResult {
  id: number;
  source: string;
  chapter: string;
  content: string;
  agent: string;
  score: number;
}

export const normativeChunkRepository = {
  /** Căutare globală (fără filtru agent) — fallback general */
  async findSimilar(vectorStr: string, limit: number): Promise<any[]> {
    return prisma.$queryRawUnsafe(`
      SELECT "source", "chapter", "content", "agent", "status",
             1 - ("embedding" <=> $1::vector) as similarity
      FROM "NormativeChunk"
      WHERE "status" != 'abrogat'
      ORDER BY similarity DESC
      LIMIT $2
    `, vectorStr, limit);
  },

  /**
   * Căutare filtrată pe agent — izolează contextul RAG per domeniu.
   * Exclude automat normativele cu status 'abrogat'.
   *
   * agent = 'geotehnic' | 'seismic' | 'legal' | 'structural' | 'materiale' | 'deviz'
   */
  async findSimilarByAgent(vectorStr: string, limit: number, agent: string): Promise<any[]> {
    return prisma.$queryRawUnsafe(`
      SELECT "source", "chapter", "content", "agent", "status",
             1 - ("embedding" <=> $1::vector) as similarity
      FROM "NormativeChunk"
      WHERE "agent" = $3
        AND "status" != 'abrogat'
      ORDER BY similarity DESC
      LIMIT $2
    `, vectorStr, limit, agent);
  },

  /** Statistici pe agenți — util pentru debugging și health-check */
  async countByAgent(): Promise<Array<{ agent: string; count: bigint }>> {
    return prisma.$queryRaw`
      SELECT agent, COUNT(*) as count
      FROM "NormativeChunk"
      GROUP BY agent
      ORDER BY count DESC
    `;
  },

  /** Dense search via pgvector pentru Hybrid Search */
  async searchDense(vectorStr: string, agent: string, isGeneral: boolean): Promise<RawChunkResult[]> {
    const denseSql = isGeneral
      ? `SELECT id, source, chapter, content, agent,
                (1 - (embedding <=> $1::vector)) AS score
         FROM "NormativeChunk"
         WHERE status != 'abrogat'
         ORDER BY score DESC
         LIMIT 20`
      : `SELECT id, source, chapter, content, agent,
                (1 - (embedding <=> $1::vector)) AS score
         FROM "NormativeChunk"
         WHERE agent = $2
           AND status != 'abrogat'
         ORDER BY score DESC
         LIMIT 20`;

    return isGeneral
      ? prisma.$queryRawUnsafe<RawChunkResult[]>(denseSql, vectorStr)
      : prisma.$queryRawUnsafe<RawChunkResult[]>(denseSql, vectorStr, agent);
  },

  /** Sparse search via native Full-Text Search pentru Hybrid Search */
  async searchSparse(question: string, agent: string, isGeneral: boolean): Promise<RawChunkResult[]> {
    const sparseSql = isGeneral
      ? `SELECT id, source, chapter, content, agent,
                ts_rank(
                  to_tsvector('simple', content),
                  plainto_tsquery('simple', $1)
                ) AS score
         FROM "NormativeChunk"
         WHERE status != 'abrogat'
           AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $1)
         ORDER BY score DESC
         LIMIT 20`
      : `SELECT id, source, chapter, content, agent,
                ts_rank(
                  to_tsvector('simple', content),
                  plainto_tsquery('simple', $1)
                ) AS score
         FROM "NormativeChunk"
         WHERE agent = $2
           AND status != 'abrogat'
           AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $1)
         ORDER BY score DESC
         LIMIT 20`;

    return isGeneral
      ? prisma.$queryRawUnsafe<RawChunkResult[]>(sparseSql, question)
      : prisma.$queryRawUnsafe<RawChunkResult[]>(sparseSql, question, agent);
  },

  /** Preluarea fragmentelor finale după IDs */
  async findChunksByIds(ids: number[]): Promise<NormativeChunk[]> {
    return prisma.normativeChunk.findMany({
      where: { id: { in: ids } },
    });
  }
};
