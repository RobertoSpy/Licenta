import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    include: { alternatives: true }
  });
  const withAlt = materials.filter(m => m.alternatives.length > 0);
  console.log(`Total materiale: ${materials.length}`);
  console.log(`Materiale cu alternative: ${withAlt.length}`);
  if (withAlt.length > 0) {
    console.log(withAlt.map(m => `${m.name} are ${m.alternatives.length} alternative`));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
