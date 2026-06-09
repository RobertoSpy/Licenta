import { prisma } from '../../../lib/prisma';
import { bomPhaseProgressRepository, BomPhaseState } from '../bomPhaseProgressRepository';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    bomPhaseProgress: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('bomPhaseProgressRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getByProject', () => {
    it('ar trebui sa returneze progresul fazelor pentru un proiect', async () => {
      const mockState = { id: 1, projectId: 1, activePhase: 'structura', completedPhases: ['fundatie'] };
      (prisma.bomPhaseProgress.findUnique as jest.Mock).mockResolvedValue(mockState);

      const result = await bomPhaseProgressRepository.getByProject(1);

      expect(prisma.bomPhaseProgress.findUnique).toHaveBeenCalledWith({ where: { projectId: 1 } });
      expect(result).toEqual(mockState);
    });
  });

  describe('upsert', () => {
    it('ar trebui sa salveze noul state al fazelor', async () => {
      const state: BomPhaseState = { activePhase: 'planseu', completedPhases: ['fundatie', 'structura'] };
      const mockResult = { id: 1, projectId: 1, ...state };
      (prisma.bomPhaseProgress.upsert as jest.Mock).mockResolvedValue(mockResult);

      const result = await bomPhaseProgressRepository.upsert(1, state);

      expect(prisma.bomPhaseProgress.upsert).toHaveBeenCalledWith({
        where: { projectId: 1 },
        update: {
          activePhase: 'planseu',
          completedPhases: ['fundatie', 'structura'],
        },
        create: {
          projectId: 1,
          activePhase: 'planseu',
          completedPhases: ['fundatie', 'structura'],
        },
      });
      expect(result).toEqual(mockResult);
    });
  });
});
