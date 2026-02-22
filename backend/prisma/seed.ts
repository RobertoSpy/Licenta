import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("Incepem popularea BD...")

  await prisma.material.deleteMany()

  await prisma.material.createMany({
    data: [
      { name: 'Cărămidă Porotherm 25', category: 'Zidărie', unit: 'Bucată', price: 8.5, storeUrl: 'https://dedeman.ro/caramida' },
      { name: 'Ciment Structo Plus 40kg', category: 'Fundație', unit: 'Sac', price: 25.9, storeUrl: 'https://dedeman.ro/ciment' },
      { name: 'Parchet Laminat Stejar 8mm', category: 'Finisaje', unit: 'Mp', price: 45.0, storeUrl: 'https://dedeman.ro/parchet' },
    ],
  })

  console.log("Materiale adaugate succes");

}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })