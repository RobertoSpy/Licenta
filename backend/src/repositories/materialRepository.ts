import { Material } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const materialRepository = {
  async findAll(): Promise<Material[]> {
    return prisma.material.findMany();
  },
};
