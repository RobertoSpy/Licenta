import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Admin User...');

  const adminEmail = process.env.ADMIN_EMAIL || 'robertospiridon1@gmail.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'Admin123!';

  const password = await bcrypt.hash(adminPass, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Administrator Zidario',
      password,
      role: UserRole.ADMIN,
      isVerified: true,
    }
  });

  console.log(`Created admin account: ${adminUser.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
