import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const normativeChunkRepository = {
  async findSimilar(vectorStr: string, limit: number): Promise<any[]> {
    return prisma.$queryRawUnsafe(`
      SELECT "source", "chapter", "content", 
             1 - ("embedding" <=> $1::vector) as similarity
      FROM "NormativeChunk"
      ORDER BY similarity DESC
      LIMIT $2
    `, vectorStr, limit);
  }
};
