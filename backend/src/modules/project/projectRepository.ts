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
  async findManyByUserId(userId: number, page: number = 1, limit: number = 10) {
    const total = await prisma.project.count({ where: { userId } });
    const skip = (page - 1) * limit;

    const data = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        bomItems: true,
        constructionPhases: true
      },
      skip,
      take: limit
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },
  async create(data: Partial<Project>): Promise<Project> {
    const DEFAULT_PHASES = [
      { name: '1. Fundație', description: 'Cofraj, armare, turnare beton', phaseOrder: 1 },
      { name: '2. Structură', description: 'Stâlpi, grinzi, pereți portanți, zidărie', phaseOrder: 2 },
      { name: '3. Planșeu', description: 'Planșeu, grinzi, armătură superioară', phaseOrder: 3 },
      { name: '4. Acoperiș', description: 'Lemnărie, folie, țiglă/tablă, sistem pluvial', phaseOrder: 4 },
      { name: '5. Finisaje', description: 'Șapă, tencuială, glet, vopsea, pardoseli', phaseOrder: 5 },
      { name: '6. Tâmplărie', description: 'Uși, ferestre exterioare și interioare', phaseOrder: 6 },
      { name: '7. Termoizolație', description: 'Izolație fațadă (ETICS), vată minerală, termosistem', phaseOrder: 7 },
      { name: '8. Instalații Electrice', description: 'Cablaje, doze, tablou electric, prize', phaseOrder: 8 },
      { name: '9. Instalații Sanitare și Termice', description: 'Tubulatură, alimentare apă, canalizare, încălzire', phaseOrder: 9 }
    ];

    return prisma.project.create({ 
      data: {
        ...(data as any),
        constructionPhases: {
          create: DEFAULT_PHASES
        }
      } 
    });
  },
  async update(id: number, data: Partial<Project>): Promise<Project> {
    return prisma.project.update({ where: { id }, data: data as any });
  },
  async delete(id: number): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }
};
