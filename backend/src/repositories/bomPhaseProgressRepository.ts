import { prisma } from '../lib/prisma';

export type BomPhaseKey =
  | 'fundatie'
  | 'structura'
  | 'planseu'
  | 'termoizolatie'
  | 'acoperis'
  | 'tamplarie'
  | 'instalatii'
  | 'finisaje'
  | 'exterior';

export type BomPhaseState = {
  activePhase: BomPhaseKey;
  completedPhases: BomPhaseKey[];
};

export const bomPhaseProgressRepository = {
  async getByProject(projectId: number) {
    return prisma.bomPhaseProgress.findUnique({ where: { projectId } });
  },

  async upsert(projectId: number, state: BomPhaseState) {
    return prisma.bomPhaseProgress.upsert({
      where: { projectId },
      update: {
        activePhase: state.activePhase,
        completedPhases: state.completedPhases,
      },
      create: {
        projectId,
        activePhase: state.activePhase,
        completedPhases: state.completedPhases,
      },
    });
  },
};
