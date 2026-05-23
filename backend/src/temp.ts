import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.$queryRawUnsafe(`SELECT source, chapter, LEFT(content, 100) as content, agent FROM "NormativeChunk" WHERE source LIKE '%114%'`);
  console.log(result);
  
  const np057 = await prisma.$queryRawUnsafe(`SELECT source, chapter, LEFT(content, 100) as content, agent FROM "NormativeChunk" WHERE source LIKE '%057%'`);
  console.log('NP057 count:', np057.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
