import { PrismaClient, Material } from '@prisma/client';

const prisma = new PrismaClient();

export const materialRepository = {
  async findAll(): Promise<Material[]> {
    return prisma.material.findMany();
  },
};
