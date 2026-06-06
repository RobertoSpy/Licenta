import { PrismaClient, UserRole } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Ștergere utilizatori normali (CLIENT)...');
  
  const deletedClients = await prisma.user.deleteMany({
    where: {
      role: UserRole.CLIENT
    }
  });
  
  console.log(`✅ Au fost șterși ${deletedClients.count} utilizatori normali.`);

  console.log('Actualizare email Admin...');
  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN }
  });
  
  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { email: 'robertospiridon1@gmail.com' }
    });
    console.log('✅ Email-ul de Admin a fost actualizat la robertospiridon1@gmail.com.');
  } else {
    console.log('❌ Nu am găsit niciun admin existent. Poți rula scriptul de seedAdmin.ts.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
