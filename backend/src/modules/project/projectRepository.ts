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
    const DEFAULT_PHASES = [
      { name: '1. Organizare Șantier și Terasamente', description: 'Pregătire, excavare, nivelare', phaseOrder: 1 },
      { name: '2. Fundație', description: 'Cofraj, armare, turnare beton', phaseOrder: 2 },
      { name: '3. Suprastructură (Zidărie/Cadre)', description: 'Stâlpi, grinzi, pereți portanți', phaseOrder: 3 },
      { name: '4. Șarpantă și Învelitoare (Acoperiș)', description: 'Lemnărie, folie, țiglă/tablă', phaseOrder: 4 },
      { name: '5. Instalații (Sanitare/Termice/Electrice)', description: 'Tubulatură, cablaje', phaseOrder: 5 },
      { name: '6. Tencuieli și Finisaje Interioare', description: 'Glet, vopsea, pardoseli', phaseOrder: 6 },
      { name: '7. Tâmplărie', description: 'Uși, ferestre', phaseOrder: 7 },
      { name: '8. Termosistem și Finisaje Exterioare', description: 'Izolație, tencuială decorativă', phaseOrder: 8 }
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
