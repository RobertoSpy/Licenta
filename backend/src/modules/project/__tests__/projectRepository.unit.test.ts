import { projectRepository } from '../projectRepository';
import { prismaMock } from '../../../../tests/setup';

describe('Project Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('returns project with bomItems included', async () => {
      const mockProject = { id: 1, title: 'Test' } as any;
      prismaMock.project.findUnique.mockResolvedValue(mockProject);

      const result = await projectRepository.findById(1);

      expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          bomItems: {
            include: {
              material: true
            }
          }
        }
      });
      expect(result).toEqual(mockProject);
    });
  });

  describe('findManyByUserId', () => {
    it('returns projects ordered by createdAt desc with bomItems', async () => {
      const mockProjects = [{ id: 1, title: 'Test' }] as any;
      prismaMock.project.findMany.mockResolvedValue(mockProjects);

      const result = await projectRepository.findManyByUserId(1);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
        include: {
          bomItems: true
        }
      });
      expect(result).toEqual(mockProjects);
    });
  });

  describe('create', () => {
    it('creates project', async () => {
      const mockProject = { id: 1, title: 'New' } as any;
      prismaMock.project.create.mockResolvedValue(mockProject);

      const result = await projectRepository.create({ title: 'New' });

      expect(prismaMock.project.create).toHaveBeenCalledWith({ data: { title: 'New' } });
      expect(result).toEqual(mockProject);
    });
  });

  describe('update', () => {
    it('updates project', async () => {
      const mockProject = { id: 1, title: 'Updated' } as any;
      prismaMock.project.update.mockResolvedValue(mockProject);

      const result = await projectRepository.update(1, { title: 'Updated' });

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { title: 'Updated' }
      });
      expect(result).toEqual(mockProject);
    });
  });

  describe('delete', () => {
    it('deletes project', async () => {
      prismaMock.project.delete.mockResolvedValue({ id: 1 } as any);

      await projectRepository.delete(1);

      expect(prismaMock.project.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
