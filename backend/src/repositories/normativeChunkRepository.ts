import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  }
};
