import { Material } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const materialRepository = {
  async findAll(): Promise<Material[]> {
    return prisma.material.findMany();
  },

  async findByInternalCodeWithAlternatives(internalCode: string) {
    return prisma.material.findUnique({
      where: { internalCode },
      include: {
        alternatives: true,
      },
    });
  },
};
