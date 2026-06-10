import { terrainRepository } from '../terrainRepository';
import { prismaMock } from '../../../../tests/setup';

describe('terrainRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateTerrainData', () => {
    it('updates project with terrain data', async () => {
      prismaMock.project.update.mockResolvedValue({ id: 1, soilType: 'Argila' } as any);
      
      const res = await terrainRepository.updateTerrainData(1, { soilType: 'Argila' });
      
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { soilType: 'Argila' }
      });
      expect(res).toEqual({ id: 1, soilType: 'Argila' });
    });
  });
});
