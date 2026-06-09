import { prisma } from '../lib/prisma';

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "NormativeChunk" ALTER COLUMN "embedding" TYPE vector(3072);');
  console.log('Altered column successfully.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
