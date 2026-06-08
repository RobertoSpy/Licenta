import { PrismaClient, UserRole, ContractorSpecialization } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding contractors...');

  const password = await bcrypt.hash('Contractor123!', 10);

  const c1 = await prisma.user.upsert({
    where: { email: 'contact@buildconstruct.ro' },
    update: {},
    create: {
      email: 'contact@buildconstruct.ro',
      name: 'Ion Constructorescu',
      password,
      role: UserRole.CONTRACTOR,
      isVerified: true,
      contractor: {
        create: {
          companyName: 'Build Construct SRL',
          cui: 'RO12345678',
          county: 'București',
          coverageRadius: 100,
          specializations: [ContractorSpecialization.CONSTRUCTII_GENERALE, ContractorSpecialization.STRUCTURA, ContractorSpecialization.FUNDATII],
          description: 'Experiență de peste 10 ani în construcții rezidențiale. Oferim calitate și seriozitate.',
          isVerified: true,
          isActive: true,
          yearsExperience: 12,
          completedProjects: 45,
          avgRating: 4.8,
        }
      }
    }
  });

  const c2 = await prisma.user.upsert({
    where: { email: 'office@finisajepremium.ro' },
    update: {},
    create: {
      email: 'office@finisajepremium.ro',
      name: 'Vasile Zugrăvescu',
      password,
      role: UserRole.CONTRACTOR,
      isVerified: true,
      contractor: {
        create: {
          companyName: 'Finisaje Premium SRL',
          cui: 'RO87654321',
          county: 'Ilfov',
          coverageRadius: 50,
          specializations: [ContractorSpecialization.FINISAJE, ContractorSpecialization.INSTALATII_ELECTRICE, ContractorSpecialization.INSTALATII_SANITARE, ContractorSpecialization.INSTALATII_TERMICE],
          description: 'Specialiști în finisaje interioare și exterioare. Executăm lucrări de calitate.',
          isVerified: true,
          isActive: true,
          yearsExperience: 8,
          completedProjects: 120,
          avgRating: 4.5,
        }
      }
    }
  });

  const c3 = await prisma.user.upsert({
    where: { email: 'robertospiridon001@gmail.com' },
    update: {},
    create: {
      email: 'robertospiridon001@gmail.com',
      name: 'Roberto Spiridon',
      password,
      role: UserRole.CONTRACTOR,
      isVerified: true,
      contractor: {
        create: {
          companyName: 'Roberto Construct',
          cui: 'RO99999999',
          county: 'București',
          coverageRadius: 200,
          specializations: [ContractorSpecialization.CONSTRUCTII_GENERALE, ContractorSpecialization.STRUCTURA, ContractorSpecialization.FINISAJE, ContractorSpecialization.INSTALATII_ELECTRICE, ContractorSpecialization.INSTALATII_SANITARE, ContractorSpecialization.INSTALATII_TERMICE],
          description: 'Constructor premium full-service. Execut lucrări de calitate.',
          isVerified: true,
          isActive: true,
          yearsExperience: 5,
          completedProjects: 15,
          avgRating: 5.0,
        }
      }
    }
  });

  console.log(`Created contractors: ${c1.email}, ${c2.email}, ${c3.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
