import { searchHybrid, searchMaterialsHybrid, ragService } from '../services/ragService';
import { embeddingService } from '../services/embeddingService';
import { prisma } from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock('../services/embeddingService', () => ({
  embeddingService: {
    embed: jest.fn(),
  },
}));

describe('ragService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchHybrid', () => {
    it('ar trebui sa returneze array gol daca agentul nu are surse (ex: materiale, deviz)', async () => {
      // deviz are 0 surse in AGENT_SOURCES_BY_PURPOSE['residential']
      const result = await searchHybrid('cost?', 'deviz', 5);
      expect(result).toEqual([]);
      expect(embeddingService.embed).not.toHaveBeenCalled();
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('ar trebui sa apeleze prisma.$queryRawUnsafe si sa filtreze pe aplicabilitate', async () => {
      (embeddingService.embed as jest.Mock).mockResolvedValue([0.1, 0.2]);
      
      const mockDbResults = [
        { id: 1, applicability: 'residential', source: 'CR1' },
        { id: 2, applicability: 'commercial', source: 'CR1' } // ar trebui filtrat pentru buildingPurpose=residential
      ];
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDbResults);

      const result = await searchHybrid('Ce este zapada?', 'structural', 5, undefined, 'residential');

      expect(embeddingService.embed).toHaveBeenCalledWith('Ce este zapada?');
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it('ar trebui sa foloseasca query general cand agentul este "general"', async () => {
      (embeddingService.embed as jest.Mock).mockResolvedValue([0.1]);
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      await searchHybrid('question', 'general', 5, ['sursa1']);

      // Ar trebui sa fie apelat cu 5 parametri pt general, nu 6 pt agent specific
      // vectorStr, sourcesPgArray, limit, question
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('WITH dense_search'),
        '[0.1]',
        ['sursa1'],
        5,
        'question'
      );
    });
  });

  describe('searchMaterialsHybrid', () => {
    it('ar trebui sa apeleze query hibrid pentru materiale', async () => {
      (embeddingService.embed as jest.Mock).mockResolvedValue([0.5]);
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ id: 1, materialName: 'BCA' }]);

      const result = await searchMaterialsHybrid('bca grosime', 3);

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('"MaterialChunk" mc'),
        '[0.5]',
        3,
        'bca grosime'
      );
      expect(result.length).toBe(1);
      expect(result[0].materialName).toBe('BCA');
    });
  });

  describe('ragService export functions', () => {
    it('searchRelevantChunks ar trebui sa returneze formatul string', async () => {
      (embeddingService.embed as jest.Mock).mockResolvedValue([0.1]);
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
        { source: 'Sursa1', chapter: 'Cap1', content: 'Text 1', applicability: 'mixed' }
      ]);

      const result = await ragService.searchRelevantChunks('test');
      expect(result).toContain('Fragmente legislative extrase:');
      expect(result).toContain('[Sursa: Sursa1 | Capitol: Cap1]');
      expect(result).toContain('Text 1');
    });

    it('searchRelevantChunks ar trebui sa trateze erorile gratios', async () => {
      (embeddingService.embed as jest.Mock).mockRejectedValue(new Error('Network err'));

      const result = await ragService.searchRelevantChunks('test');
      expect(result).toBe('Serviciul RAG întâmpină probleme de conectivitate.');
    });

    it('searchRelevantMaterialChunks ar trebui sa trateze erorile gratios', async () => {
      (embeddingService.embed as jest.Mock).mockRejectedValue(new Error('Network err'));

      const result = await ragService.searchRelevantMaterialChunks('test');
      expect(result).toBe('Serviciul RAG pentru materiale întâmpină probleme.');
    });
  });
});
