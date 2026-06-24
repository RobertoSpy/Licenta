// backend/src/modules/bom/__tests__/materialSelector.unit.test.ts
import { selectMaterialForBOM, MaterialQuery } from '../materialSelector';
import { prisma } from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    material: {
      findMany: jest.fn()
    }
  }
}));

describe('Material Selector Engine - Role-Based Budget Tests', () => {
  const mockMaterialsList = [
    { id: 1, name: 'BCA Ieftin 25cm', subcategory: 'EXTERIOR_WALL_25CM', pricePerUnit: 50 },
    { id: 2, name: 'BCA Mediu Celco 25cm', subcategory: 'EXTERIOR_WALL_25CM', pricePerUnit: 75 },
    { id: 3, name: 'BCA Premium Ytong 25cm', subcategory: 'EXTERIOR_WALL_25CM', pricePerUnit: 110 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Ar trebui să returneze cel mai ieftin material pentru categoria ECONOMIC', async () => {
    (prisma.material.findMany as jest.Mock).mockResolvedValue(mockMaterialsList);

    const query: MaterialQuery = { category: 'Zidărie', subcategory: 'EXTERIOR_WALL_25CM' };
    const selected = await selectMaterialForBOM(query, 'economic', undefined);

    expect(selected).not.toBeNull();
    expect(selected?.id).toBe(1); // BCA Ieftin (50 RON)
    expect(selected?.pricePerUnit).toBe(50);
  });

  test('Ar trebui să aplice algoritmul median și să returneze materialul de mijloc pentru categoria MEDIU', async () => {
    (prisma.material.findMany as jest.Mock).mockResolvedValue(mockMaterialsList);

    const query: MaterialQuery = { category: 'Zidărie', subcategory: 'EXTERIOR_WALL_25CM' };
    const selected = await selectMaterialForBOM(query, 'mediu', undefined);

    expect(selected).not.toBeNull();
    expect(selected?.id).toBe(2); // BCA Mediu Celco (75 RON)
  });
});
