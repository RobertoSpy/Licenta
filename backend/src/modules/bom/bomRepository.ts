import { prisma } from '../../lib/prisma';
import { ProjectBOM, Prisma } from '@prisma/client';

class BOMRepository {
  async deleteByProject(projectId: number): Promise<void> {
    await prisma.projectBOM.deleteMany({
      where: { projectId }
    });
  }

  async createMany(items: Prisma.ProjectBOMCreateManyInput[]): Promise<void> {
    await prisma.projectBOM.createMany({
      data: items
    });
  }

  async findByProject(projectId: number): Promise<(ProjectBOM & { material: any })[]> {
    return prisma.projectBOM.findMany({
      where: { projectId },
      include: {
        material: true
      },
      orderBy: {
        phase: 'asc' // Not perfect chronological, but helps group them. In production we might order by phaseOrder from ConstructionPhase
      }
    });
  }
}

export const bomRepository = new BOMRepository();
