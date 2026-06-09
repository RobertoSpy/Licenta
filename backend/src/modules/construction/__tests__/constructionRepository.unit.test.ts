import { constructionRepository } from '../constructionRepository';
import { prisma } from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    constructionPhase: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    }
  }
}));

const prismaMock = prisma as jest.Mocked<typeof prisma>;

describe('ConstructionRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByProject', () => {
    it('returns phases ordered by phaseOrder', async () => {
      const mockPhases = [{ id: 1, phaseOrder: 1 }, { id: 2, phaseOrder: 2 }];
      (prismaMock.constructionPhase.findMany as jest.Mock).mockResolvedValue(mockPhases);

      const result = await constructionRepository.getByProject(10);
      
      expect(prismaMock.constructionPhase.findMany).toHaveBeenCalledWith({
        where: { projectId: 10 },
        orderBy: { phaseOrder: 'asc' }
      });
      expect(result).toEqual(mockPhases);
    });
  });

  describe('createMany', () => {
    it('calls createMany with provided data', async () => {
      const data = [{ projectId: 1, name: 'Phase 1' }];
      (prismaMock.constructionPhase.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      await constructionRepository.createMany(data);

      expect(prismaMock.constructionPhase.createMany).toHaveBeenCalledWith({
        data
      });
    });
  });

  describe('deleteByProject', () => {
    it('deletes phases for given project', async () => {
      (prismaMock.constructionPhase.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      await constructionRepository.deleteByProject(10);

      expect(prismaMock.constructionPhase.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 10 }
      });
    });
  });

  describe('markPhaseCompleted', () => {
    it('updates phase with composite key', async () => {
      const updatedPhase = { id: 1, isCompleted: true };
      (prismaMock.constructionPhase.update as jest.Mock).mockResolvedValue(updatedPhase);

      const result = await constructionRepository.markPhaseCompleted(10, 2);

      expect(prismaMock.constructionPhase.update).toHaveBeenCalledWith({
        where: {
          projectId_phaseOrder: {
            projectId: 10,
            phaseOrder: 2
          }
        },
        data: {
          isCompleted: true,
          completedAt: expect.any(Date)
        }
      });
      expect(result).toEqual(updatedPhase);
    });

    it('throws if composite key does not exist', async () => {
      (prismaMock.constructionPhase.update as jest.Mock).mockRejectedValue(new Error('Record not found'));

      await expect(constructionRepository.markPhaseCompleted(10, 99)).rejects.toThrow('Record not found');
    });
  });
});
