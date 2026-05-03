import { PrismaClient, Project } from '@prisma/client';

const prisma = new PrismaClient();

export const terrainRepository = {
  async updateTerrainData(projectId: number, terrainData: any): Promise<Project> {
    return prisma.project.update({
      where: { id: projectId },
      data: terrainData
    });
  }
};
