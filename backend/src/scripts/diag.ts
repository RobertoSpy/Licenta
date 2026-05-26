import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Query 1: chunks per agent/source ---');
  const q1 = await prisma.$queryRaw`
    SELECT agent, source, COUNT(*)::int as chunks, COUNT(embedding)::int as with_embeddings
    FROM "NormativeChunk"
    GROUP BY agent, source
    ORDER BY agent, source;
  `;
  console.table(q1);

  console.log('\n--- Query 2: chunks per agent ---');
  const q2 = await prisma.$queryRaw`
    SELECT agent, COUNT(*)::int as total, COUNT(embedding)::int as cu_embedding
    FROM "NormativeChunk"
    GROUP BY agent;
  `;
  console.table(q2);

  console.log('\n--- Query 3: distinct agents ---');
  const q3 = await prisma.$queryRaw`
    SELECT DISTINCT agent FROM "NormativeChunk" LIMIT 20;
  `;
  console.table(q3);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
