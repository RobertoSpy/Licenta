import { bomService } from '../modules/bom/bomService';
import { prisma } from '../lib/prisma';

async function run() {
  const projectId = 1; // You can change this to an existing valid project ID in your DB
  const start = performance.now();
  
  try {
    console.log('Generating BOM...');
    await bomService.calculateBOM(projectId);
    const end = performance.now();
    console.log(`BOM Engine execution time: ${(end - start).toFixed(2)} ms`);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
