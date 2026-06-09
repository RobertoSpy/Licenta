import { prisma } from '../../../lib/prisma';
import { bomRepository } from '../bomRepository';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    projectBOM: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('BOMRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteByProject', () => {
    it('ar trebui sa stearga toate intrarile BOM pentru un proiect', async () => {
      await bomRepository.deleteByProject(1);
      expect(prisma.projectBOM.deleteMany).toHaveBeenCalledWith({ where: { projectId: 1 } });
    });
  });

  describe('createMany', () => {
    it('ar trebui sa creeze inregistrari multiple BOM', async () => {
      const mockItems: any[] = [{ projectId: 1, materialId: 10, quantity: 5, phase: 'fundatie' }];
      await bomRepository.createMany(mockItems);
      expect(prisma.projectBOM.createMany).toHaveBeenCalledWith({ data: mockItems });
    });
  });

  describe('findByProject', () => {
    it('ar trebui sa returneze toate intrarile BOM cu detalii material pentru un proiect', async () => {
      const mockResult = [{ id: 1, phase: 'structura', material: { name: 'Beton' } }];
      (prisma.projectBOM.findMany as jest.Mock).mockResolvedValue(mockResult);

      const result = await bomRepository.findByProject(1);

      expect(prisma.projectBOM.findMany).toHaveBeenCalledWith({
        where: { projectId: 1 },
        include: { material: true },
        orderBy: { phase: 'asc' },
      });
      expect(result).toEqual(mockResult);
    });
  });
});
