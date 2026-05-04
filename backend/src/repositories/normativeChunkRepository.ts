import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const normativeChunkRepository = {
  /** Căutare globală (fără filtru agent) — fallback general */
  async findSimilar(vectorStr: string, limit: number): Promise<any[]> {
    return prisma.$queryRawUnsafe(`
      SELECT "source", "chapter", "content", "agent",
             1 - ("embedding" <=> $1::vector) as similarity
      FROM "NormativeChunk"
      ORDER BY similarity DESC
      LIMIT $2
    `, vectorStr, limit);
  },

  /**
   * Căutare filtrată pe agent — izolează contextul RAG per domeniu.
   * agent = 'geotehnic' | 'seismic' | 'legal' | 'general'
   */
  async findSimilarByAgent(vectorStr: string, limit: number, agent: string): Promise<any[]> {
    return prisma.$queryRawUnsafe(`
      SELECT "source", "chapter", "content", "agent",
             1 - ("embedding" <=> $1::vector) as similarity
      FROM "NormativeChunk"
      WHERE "agent" = $3
      ORDER BY similarity DESC
      LIMIT $2
    `, vectorStr, limit, agent);
  }
};
