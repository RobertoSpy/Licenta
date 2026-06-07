import { prisma } from '../../../lib/prisma';
import { bomIntroCacheRepository } from '../bomIntroCacheRepository';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    bomIntroCache: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('bomIntroCacheRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getByProject', () => {
    it('ar trebui sa returneze cache-ul pentru un proiect valid', async () => {
      const mockCache = { id: 1, projectId: 123, introText: 'Test intro' };
      (prisma.bomIntroCache.findUnique as jest.Mock).mockResolvedValue(mockCache);

      const result = await bomIntroCacheRepository.getByProject(123);
      
      expect(prisma.bomIntroCache.findUnique).toHaveBeenCalledWith({ where: { projectId: 123 } });
      expect(result).toEqual(mockCache);
    });

    it('ar trebui sa returneze null daca nu exista cache', async () => {
      (prisma.bomIntroCache.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await bomIntroCacheRepository.getByProject(999);
      
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('ar trebui sa faca upsert la textul de intro', async () => {
      const mockCache = { id: 1, projectId: 123, introText: 'New intro text' };
      (prisma.bomIntroCache.upsert as jest.Mock).mockResolvedValue(mockCache);

      const result = await bomIntroCacheRepository.upsert(123, 'New intro text');

      expect(prisma.bomIntroCache.upsert).toHaveBeenCalledWith({
        where: { projectId: 123 },
        update: { introText: 'New intro text' },
        create: { projectId: 123, introText: 'New intro text' },
      });
      expect(result).toEqual(mockCache);
    });
  });
});
