import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Query 1: Counts by agent ---');
  const counts = await prisma.$queryRaw`
    SELECT agent, COUNT(*)::int as count 
    FROM "NormativeChunk" 
    WHERE source = 'NP112-2014' 
    GROUP BY agent;
  `;
  console.log(counts);

  console.log('\\n--- Query 2: First 10 chunks ---');
  const chunks = await prisma.$queryRaw`
    SELECT chapter, LEFT(content, 200) as content 
    FROM "NormativeChunk" 
    WHERE source = 'NP112-2014' 
    ORDER BY id 
    LIMIT 10;
  `;
  console.log(chunks);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
