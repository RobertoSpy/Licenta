import { materialRepository } from '../materialRepository';
import { prismaMock } from '../../../../tests/setup';

describe('Material Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all materials from prisma', async () => {
      const mockMaterials = [
        { id: 1, internalCode: 'MAT-1', name: 'Material 1', pricePerUnit: 100 } as any,
      ];
      prismaMock.material.findMany.mockResolvedValue(mockMaterials);

      const result = await materialRepository.findAll();

      expect(prismaMock.material.findMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockMaterials);
    });
  });

  describe('findByInternalCodeWithAlternatives', () => {
    it('findByInternalCodeWithAlternatives returns null for unknown code', async () => {
      prismaMock.material.findUnique.mockResolvedValue(null);

      const result = await materialRepository.findByInternalCodeWithAlternatives('UNKNOWN');

      expect(prismaMock.material.findUnique).toHaveBeenCalledWith({
        where: { internalCode: 'UNKNOWN' },
        include: { alternatives: true },
      });
      expect(result).toBeNull();
    });

    it('findByInternalCodeWithAlternatives returns material with alternatives array', async () => {
      const mockMaterial = {
        id: 1,
        internalCode: 'MAT-1',
        alternatives: [{ id: 2, internalCode: 'MAT-2' }],
      } as any;
      prismaMock.material.findUnique.mockResolvedValue(mockMaterial);

      const result = await materialRepository.findByInternalCodeWithAlternatives('MAT-1');

      expect(result).toEqual(mockMaterial);
      expect(result?.alternatives).toHaveLength(1);
    });

    it('findByInternalCodeWithAlternatives returns material with empty alternatives array when none exist', async () => {
      const mockMaterial = {
        id: 1,
        internalCode: 'MAT-1',
        alternatives: [],
      } as any;
      prismaMock.material.findUnique.mockResolvedValue(mockMaterial);

      const result = await materialRepository.findByInternalCodeWithAlternatives('MAT-1');

      expect(result).toEqual(mockMaterial);
      expect(result?.alternatives).toEqual([]);
    });
  });
});
