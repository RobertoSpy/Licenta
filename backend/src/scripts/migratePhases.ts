import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../lib/prisma';

const DEFAULT_PHASES = [
  { name: '1. Fundație', description: 'Cofraj, armare, turnare beton', phaseOrder: 1 },
  { name: '2. Structură', description: 'Stâlpi, grinzi, pereți portanți, zidărie', phaseOrder: 2 },
  { name: '3. Planșeu', description: 'Planșeu, grinzi, armătură superioară', phaseOrder: 3 },
  { name: '4. Acoperiș', description: 'Lemnărie, folie, țiglă/tablă, sistem pluvial', phaseOrder: 4 },
  { name: '5. Finisaje', description: 'Șapă, tencuială, glet, vopsea, pardoseli', phaseOrder: 5 },
  { name: '6. Tâmplărie', description: 'Uși, ferestre exterioare și interioare', phaseOrder: 6 },
  { name: '7. Termoizolație', description: 'Izolație fațadă (ETICS), vată minerală, termosistem', phaseOrder: 7 },
  { name: '8. Instalații Electrice', description: 'Cablaje, doze, tablou electric, prize', phaseOrder: 8 },
  { name: '9. Instalații Sanitare și Termice', description: 'Tubulatură, alimentare apă, canalizare, încălzire', phaseOrder: 9 }
];

async function main() {
  console.log('Migrating existing project phases...');
  const projects = await prisma.project.findMany();
  
  for (const project of projects) {
    // Delete existing phases
    await prisma.constructionPhase.deleteMany({
      where: { projectId: project.id }
    });
    
    // Create new 9 phases
    await prisma.constructionPhase.createMany({
      data: DEFAULT_PHASES.map(phase => ({
        projectId: project.id,
        ...phase
      }))
    });
    console.log(`Updated phases for project ${project.id}`);
  }
  
  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
