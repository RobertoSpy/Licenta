import { Project } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const terrainRepository = {
  async updateTerrainData(projectId: number, terrainData: any): Promise<Project> {
    return prisma.project.update({
      where: { id: projectId },
      data: terrainData
    });
  }
};
