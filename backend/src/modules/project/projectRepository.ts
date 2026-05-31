import { Project } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const projectRepository = {
  async findById(id: number): Promise<Project | null> {
    return prisma.project.findUnique({ 
      where: { id },
      include: {
        bomItems: {
          include: {
            material: true
          }
        }
      } 
    });
  },
  async findManyByUserId(userId: number): Promise<Project[]> {
    return prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        bomItems: true
      }
    });
  },
  async create(data: Partial<Project>): Promise<Project> {
    return prisma.project.create({ data: data as any });
  },
  async update(id: number, data: Partial<Project>): Promise<Project> {
    return prisma.project.update({ where: { id }, data: data as any });
  },
  async delete(id: number): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }
};
