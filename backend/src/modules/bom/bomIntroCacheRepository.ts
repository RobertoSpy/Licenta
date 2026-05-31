import { prisma } from '../../lib/prisma';

export const bomIntroCacheRepository = {
  async getByProject(projectId: number) {
    return prisma.bomIntroCache.findUnique({ where: { projectId } });
  },

  async upsert(projectId: number, introText: string) {
    return prisma.bomIntroCache.upsert({
      where: { projectId },
      update: { introText },
      create: { projectId, introText },
    });
  },
};
