import { prisma } from '../../lib/prisma';
import { ConstructionPhase } from '@prisma/client';

class ConstructionRepository {
  async getByProject(projectId: number): Promise<ConstructionPhase[]> {
    return prisma.constructionPhase.findMany({
      where: { projectId },
      orderBy: { phaseOrder: 'asc' }
    });
  }

  async createMany(phases: any[]): Promise<void> {
    await prisma.constructionPhase.createMany({
      data: phases
    });
  }

  async deleteByProject(projectId: number): Promise<void> {
    await prisma.constructionPhase.deleteMany({
      where: { projectId }
    });
  }

  async markPhaseCompleted(projectId: number, phaseOrder: number): Promise<ConstructionPhase> {
    return prisma.constructionPhase.update({
      where: {
        projectId_phaseOrder: {
          projectId,
          phaseOrder
        }
      },
      data: {
        isCompleted: true,
        completedAt: new Date()
      }
    });
  }
}

export const constructionRepository = new ConstructionRepository();
