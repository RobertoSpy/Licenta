import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.material.findFirst({where: {name: {contains: 'Ferestre PVC 2 geamuri Low-E'}}}).then(m => console.log('Ferestre:', JSON.stringify(m, null, 2))).catch(console.error).finally(() => prisma.$disconnect());
