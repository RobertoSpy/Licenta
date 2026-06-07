import { constructionService } from '../constructionService';
import { constructionRepository } from '../constructionRepository';
import fs from 'fs';
import path from 'path';

jest.mock('../constructionRepository');
jest.mock('fs');

const mockRepo = constructionRepository as jest.Mocked<typeof constructionRepository>;

describe('ConstructionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePhasesForProject', () => {
    it('throws descriptive error if JSON file is missing', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(constructionService.generatePhasesForProject(1)).rejects.toThrow('MISSING_JSON_FILE');
    });

    it('throws if JSON is malformed', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid-json');

      await expect(constructionService.generatePhasesForProject(1)).rejects.toThrow('MALFORMED_JSON_FILE');
    });

    it('is idempotent: deletes old phases before creating new ones', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([{ order: 1, name: 'Phase 1' }]));

      mockRepo.deleteByProject.mockResolvedValue(undefined);
      mockRepo.createMany.mockResolvedValue(undefined);
      mockRepo.getByProject.mockResolvedValue([{ id: 1 } as any]);

      await constructionService.generatePhasesForProject(1);

      expect(mockRepo.deleteByProject).toHaveBeenCalledWith(1);
      expect(mockRepo.createMany).toHaveBeenCalledWith([expect.objectContaining({ name: 'Phase 1' })]);
      // Verify delete is called before createMany
      const deleteOrder = mockRepo.deleteByProject.mock.invocationCallOrder[0];
      const createOrder = mockRepo.createMany.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });
  });

  describe('getProjectPhases', () => {
    it('returns existing phases without generating', async () => {
      mockRepo.getByProject.mockResolvedValue([{ id: 1 } as any]);
      const generateSpy = jest.spyOn(constructionService, 'generatePhasesForProject');

      const result = await constructionService.getProjectPhases(1);

      expect(result).toHaveLength(1);
      expect(generateSpy).not.toHaveBeenCalled();
    });

    it('generates phases if none exist', async () => {
      mockRepo.getByProject
        .mockResolvedValueOnce([]) // First call returns empty
        .mockResolvedValueOnce([{ id: 1 } as any]); // generatePhasesForProject's call

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
      
      const result = await constructionService.getProjectPhases(1);

      expect(result).toHaveLength(1);
    });
  });

  describe('completePhase', () => {
    const mockPhases = [
      { id: 10, phaseOrder: 1, isCompleted: true },
      { id: 11, phaseOrder: 2, isCompleted: false },
      { id: 12, phaseOrder: 3, isCompleted: false },
    ];

    it('throws if phase not found', async () => {
      mockRepo.getByProject.mockResolvedValue(mockPhases as any);
      await expect(constructionService.completePhase(1, 99)).rejects.toThrow('PHASE_NOT_FOUND');
    });

    it('is idempotent: completing an already-completed phase does not throw and returns phase', async () => {
      mockRepo.getByProject.mockResolvedValue(mockPhases as any);
      const result = await constructionService.completePhase(1, 1);
      expect(result).toEqual(mockPhases[0]);
      expect(mockRepo.markPhaseCompleted).not.toHaveBeenCalled();
    });

    it('throws if previous phase is not completed', async () => {
      mockRepo.getByProject.mockResolvedValue(mockPhases as any);
      // Phase 2 is not completed. Trying to complete phase 3.
      await expect(constructionService.completePhase(1, 3)).rejects.toThrow('PREREQUISITE_NOT_COMPLETED');
    });

    it('succeeds when previous phase is completed', async () => {
      mockRepo.getByProject.mockResolvedValue(mockPhases as any);
      // Phase 1 is completed. Trying to complete phase 2.
      mockRepo.markPhaseCompleted.mockResolvedValue({ id: 11, isCompleted: true } as any);
      
      const result = await constructionService.completePhase(1, 2);
      
      expect(mockRepo.markPhaseCompleted).toHaveBeenCalledWith(1, 2);
      expect(result.isCompleted).toBe(true);
    });

    it('completePhase on phase 1 (no prerequisite) always succeeds', async () => {
      const mockPhasesUncompleted = [
        { id: 10, phaseOrder: 1, isCompleted: false },
      ];
      mockRepo.getByProject.mockResolvedValue(mockPhasesUncompleted as any);
      mockRepo.markPhaseCompleted.mockResolvedValue({ id: 10, isCompleted: true } as any);

      await constructionService.completePhase(1, 1);
      expect(mockRepo.markPhaseCompleted).toHaveBeenCalledWith(1, 1);
    });
  });
});
