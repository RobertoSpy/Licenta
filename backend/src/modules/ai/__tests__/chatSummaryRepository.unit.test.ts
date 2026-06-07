import { prisma } from '../../../lib/prisma';
import { chatSummaryRepository } from '../chatSummaryRepository';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    chatSummary: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('chatSummaryRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOne', () => {
    it('ar trebui sa apeleze prisma.chatSummary.findUnique cu argumentele corecte', async () => {
      const mockResult = { id: 1, summary: 'rezumat' };
      (prisma.chatSummary.findUnique as jest.Mock).mockResolvedValue(mockResult);

      const result = await chatSummaryRepository.getOne(1, 'faza1', 'screen1');

      expect(prisma.chatSummary.findUnique).toHaveBeenCalledWith({
        where: { projectId_phase_screen: { projectId: 1, phase: 'faza1', screen: 'screen1' } }
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getMany', () => {
    it('ar trebui sa apeleze prisma.chatSummary.findMany cu argumentele corecte si orderBy createdAt', async () => {
      const mockResults = [{ id: 1 }, { id: 2 }];
      (prisma.chatSummary.findMany as jest.Mock).mockResolvedValue(mockResults);

      const result = await chatSummaryRepository.getMany(1, ['screen1', 'screen2']);

      expect(prisma.chatSummary.findMany).toHaveBeenCalledWith({
        where: { projectId: 1, screen: { in: ['screen1', 'screen2'] } },
        orderBy: { createdAt: 'asc' }
      });
      expect(result).toEqual(mockResults);
    });
  });

  describe('upsert', () => {
    it('ar trebui sa apeleze prisma.chatSummary.upsert cu argumentele corecte', async () => {
      const mockResult = { id: 1, summary: 'nou rezumat' };
      (prisma.chatSummary.upsert as jest.Mock).mockResolvedValue(mockResult);

      const result = await chatSummaryRepository.upsert(1, 'faza1', 'screen1', 'nou rezumat');

      expect(prisma.chatSummary.upsert).toHaveBeenCalledWith({
        where: { projectId_phase_screen: { projectId: 1, phase: 'faza1', screen: 'screen1' } },
        update: { summary: 'nou rezumat', updatedAt: expect.any(Date) },
        create: { projectId: 1, phase: 'faza1', screen: 'screen1', summary: 'nou rezumat' }
      });
      expect(result).toEqual(mockResult);
    });
  });
});
