import { prisma } from '../../../lib/prisma';
import { selectMaterialForBOM, MaterialQuery } from '../materialSelector';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    material: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('materialSelector', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('STRICT_NORMATIVE', () => {
    it('ar trebui sa returneze materialul exact cerut de motor (engineSuggestedCode)', async () => {
      const mockMaterial = { internalCode: 'MAT-123', name: 'Beton C25/30' };
      (prisma.material.findUnique as jest.Mock).mockResolvedValue(mockMaterial);

      const query: MaterialQuery = { type: 'STRICT_NORMATIVE', engineKey: 'beton_structura' };
      const result = await selectMaterialForBOM(query, 'economic', 'MAT-123');

      expect(prisma.material.findUnique).toHaveBeenCalledWith({
        where: { internalCode: 'MAT-123' },
      });
      expect(result).toEqual(mockMaterial);
    });

    it('ar trebui sa arunce eroare daca engineSuggestedCode lipseste', async () => {
      const query: MaterialQuery = { type: 'STRICT_NORMATIVE', engineKey: 'beton_structura' };
      await expect(selectMaterialForBOM(query, 'economic')).rejects.toThrow('Lipsă engineSuggestedCode pentru beton_structura');
    });
  });

  describe('NORMATIVE_BUDGET', () => {
    it('ar trebui sa aplice constrangerile normative de baza (U-value, rezistenta, seism)', async () => {
      const mockMaterials = [{ internalCode: 'MAT-A' }, { internalCode: 'MAT-B' }];
      (prisma.material.findMany as jest.Mock).mockResolvedValue(mockMaterials);

      const query: MaterialQuery = {
        type: 'NORMATIVE_BUDGET',
        category: 'zidarie',
        constraints: {
          maxUValue: 0.3,
          minStrength: 10,
        },
      };

      await selectMaterialForBOM(query, 'economic', undefined, 0.25);

      expect(prisma.material.findMany).toHaveBeenCalledWith({
        where: {
          category: 'zidarie',
          inStock: true,
          uValue: { lte: 0.3 },
          compressiveStrength: { gte: 10 },
          OR: [
            { minSeismicZone: { lte: 0.25 } },
            { minSeismicZone: null },
          ],
        },
        orderBy: { pricePerUnit: 'asc' },
      });
    });

    it('ar trebui sa aleaga optiunea mediana pentru buget "mediu"', async () => {
      const mockMaterials = [
        { internalCode: 'MAT-1', pricePerUnit: 10 },
        { internalCode: 'MAT-2', pricePerUnit: 20 },
        { internalCode: 'MAT-3', pricePerUnit: 30 },
      ];
      (prisma.material.findMany as jest.Mock).mockResolvedValue(mockMaterials);

      const query: MaterialQuery = { type: 'NORMATIVE_BUDGET', category: 'zidarie' };
      const result = await selectMaterialForBOM(query, 'mediu');

      // 3 elements -> median is index 1 (MAT-2)
      expect(result).toEqual(mockMaterials[1]);
    });
  });

  describe('FREE_PREFERENCE', () => {
    it('ar trebui sa nu aplice constrangeri suplimentare pentru FREE_PREFERENCE', async () => {
      const mockMaterials = [{ internalCode: 'MAT-1' }];
      (prisma.material.findMany as jest.Mock).mockResolvedValue(mockMaterials);

      const query: MaterialQuery = { type: 'FREE_PREFERENCE', category: 'finisaje' };
      await selectMaterialForBOM(query, 'economic');

      expect(prisma.material.findMany).toHaveBeenCalledWith({
        where: {
          category: 'finisaje',
          inStock: true,
        },
        orderBy: { pricePerUnit: 'asc' },
      });
    });

    it('ar trebui sa returneze null daca nu gaseste materiale', async () => {
      (prisma.material.findMany as jest.Mock).mockResolvedValue([]);

      const query: MaterialQuery = { type: 'FREE_PREFERENCE', category: 'finisaje' };
      const result = await selectMaterialForBOM(query, 'economic');

      expect(result).toBeNull();
    });
  });
});
