import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const bySource = await p.$queryRaw`
    SELECT source, agent, applicability, COUNT(*)::int as total 
    FROM "NormativeChunk" 
    WHERE source IN ('CR1-1-4-2012', 'Legea350-2001', 'NP051-2012', 'NP057-2002', 'P118-99')
    GROUP BY source, agent, applicability 
    ORDER BY source, total DESC
  ` as any[];
  
  console.log('\n=== Chunks pentru sursele architectural/residential ===');
  console.table(bySource);

  // Verificam daca exista chunks cu embedding pentru aceste surse
  const withEmb = await p.$queryRaw`
    SELECT source, COUNT(*)::int as with_embedding, 
           COUNT(CASE WHEN embedding IS NULL THEN 1 END)::int as no_embedding
    FROM "NormativeChunk" 
    WHERE source IN ('CR1-1-4-2012', 'Legea350-2001', 'NP051-2012', 'NP057-2002', 'P118-99')
    GROUP BY source
  ` as any[];
  console.log('\n=== Embeddings per sursă ===');
  console.table(withEmb);
}

main().finally(() => p.$disconnect());
