import { prisma } from '../../../lib/prisma';
import { normativeChunkRepository } from '../normativeChunkRepository';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
    normativeChunk: {
      findMany: jest.fn(),
    },
  },
}));

describe('normativeChunkRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findSimilar', () => {
    it('ar trebui sa apeleze prisma.$queryRawUnsafe cu vectorul si limita corecta', async () => {
      const mockResult = [{ source: 'NP112', similarity: 0.9 }];
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockResult);

      const result = await normativeChunkRepository.findSimilar('[0.1, 0.2]', 5);

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SELECT "source", "chapter", "content", "agent"'),
        '[0.1, 0.2]',
        5
      );
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('status" != \'abrogat\''),
        expect.anything(),
        expect.anything()
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('findSimilarByAgent', () => {
    it('ar trebui sa apeleze prisma.$queryRawUnsafe incluzand conditia de agent', async () => {
      const mockResult = [{ source: 'P100', similarity: 0.85 }];
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockResult);

      const result = await normativeChunkRepository.findSimilarByAgent('[0.3, 0.4]', 3, 'seismic');

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('"agent" = $3'),
        '[0.3, 0.4]',
        3,
        'seismic'
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('countByAgent', () => {
    it('ar trebui sa apeleze prisma.$queryRaw pentru a aduce gruparile de agenti', async () => {
      const mockResult = [{ agent: 'seismic', count: BigInt(10) }];
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResult);

      const result = await normativeChunkRepository.countByAgent();

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('findChunksByIds', () => {
    it('ar trebui sa apeleze findMany cu un array de ID-uri', async () => {
      const mockResult = [{ id: 1, source: 'A' }, { id: 2, source: 'B' }];
      (prisma.normativeChunk.findMany as jest.Mock).mockResolvedValue(mockResult);

      const result = await normativeChunkRepository.findChunksByIds([1, 2]);

      expect(prisma.normativeChunk.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } }
      });
      expect(result).toEqual(mockResult);
    });
  });
});
