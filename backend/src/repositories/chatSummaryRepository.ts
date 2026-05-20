import { prisma } from '../lib/prisma';

export const chatSummaryRepository = {
  /**
   * Returnează un singur rezumat pentru combinația (projectId, phase, screen).
   * Folosit la mount-ul unui ecran pentru a restaura contextul conversației.
   */
  async getOne(projectId: number, phase: string, screen: string | null) {
    return prisma.chatSummary.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        projectId_phase_screen: { projectId, phase, screen } as any
      }
    });
  },

  /**
   * Returnează rezumatele pentru un set de screen-uri (dependențe).
   * Folosit pentru a construi contextul cross-screen la mount.
   */
  async getMany(projectId: number, screens: string[]) {
    return prisma.chatSummary.findMany({
      where: {
        projectId,
        screen: { in: screens }
      },
      orderBy: { createdAt: 'asc' }
    });
  },

  /**
   * Creează sau actualizează rezumatul pentru (projectId, phase, screen).
   * Apelat automat de useZidarioChat la fiecare 10 mesaje.
   */
  async upsert(
    projectId: number,
    phase: string,
    screen: string | null,
    summary: string
  ) {
    return prisma.chatSummary.upsert({
      where: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        projectId_phase_screen: { projectId, phase, screen } as any
      },
      update: { summary, updatedAt: new Date() },
      create: { projectId, phase, screen, summary }
    });
  }
};
