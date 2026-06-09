import { editorRepository } from '../editorRepository';
import { prismaMock } from '../../../../tests/setup';

describe('Editor Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanupOldSnapshots', () => {
    it('does nothing if snapshots count is <= 20', async () => {
      // Return 15 snapshots
      prismaMock.planSnapshot.findMany.mockResolvedValue(
        Array.from({ length: 15 }).map((_, i) => ({ id: i })) as any
      );
      
      await editorRepository.cleanupOldSnapshots(1, 'parter');
      
      expect(prismaMock.planSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { projectId: 1, floor: 'parter', isPublished: false },
        orderBy: { createdAt: 'desc' }
      }));
      expect(prismaMock.planSnapshot.deleteMany).not.toHaveBeenCalled();
    });

    it('keeps exactly 20 most recent snapshots when 21 exist', async () => {
      // 21 snapshots returned (index 0..20)
      const mockSnapshots = Array.from({ length: 21 }).map((_, i) => ({ id: i }));
      prismaMock.planSnapshot.findMany.mockResolvedValue(mockSnapshots as any);
      
      await editorRepository.cleanupOldSnapshots(1, 'parter');
      
      expect(prismaMock.planSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [20] } } // Only the 21st item should be deleted
      });
    });

    it('keeps exactly 20 most recent snapshots when 100 exist', async () => {
      const mockSnapshots = Array.from({ length: 100 }).map((_, i) => ({ id: i }));
      prismaMock.planSnapshot.findMany.mockResolvedValue(mockSnapshots as any);
      
      await editorRepository.cleanupOldSnapshots(1, 'parter');
      
      // Should delete 80 items (index 20 to 99)
      const expectedToDelete = Array.from({ length: 80 }).map((_, i) => i + 20);
      expect(prismaMock.planSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: expectedToDelete } }
      });
    });

    it('does not delete published snapshot even if it is oldest', async () => {
      // The `findMany` query explicitly filters by `isPublished: false`.
      // We verify the query arguments to ensure this rule is enforced at the DB query level.
      await editorRepository.cleanupOldSnapshots(1, 'parter');
      
      expect(prismaMock.planSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ isPublished: false })
      }));
    });
  });

  describe('verifySnapshotOwnership', () => {
    it('returns true when all ownership checks pass', async () => {
      prismaMock.planSnapshot.findUnique.mockResolvedValue({
        id: 1,
        project: { id: 10, userId: 100 }
      } as any);

      const result = await editorRepository.verifySnapshotOwnership(1, 100, 10);
      expect(result).toBe(true);
    });

    it('returns false when snapshot exists but belongs to different project', async () => {
      prismaMock.planSnapshot.findUnique.mockResolvedValue({
        id: 1,
        project: { id: 20, userId: 100 } // User owns it, but it's project 20
      } as any);

      const result = await editorRepository.verifySnapshotOwnership(1, 100, 10);
      expect(result).toBe(false);
    });

    it('returns false when project exists but belongs to different user', async () => {
      prismaMock.planSnapshot.findUnique.mockResolvedValue({
        id: 1,
        project: { id: 10, userId: 200 } // Project 10, but owned by user 200
      } as any);

      const result = await editorRepository.verifySnapshotOwnership(1, 100, 10);
      expect(result).toBe(false);
    });

    it('returns false when snapshot does not exist at all', async () => {
      prismaMock.planSnapshot.findUnique.mockResolvedValue(null);

      const result = await editorRepository.verifySnapshotOwnership(1, 100, 10);
      expect(result).toBe(false);
    });

    it('returns true when omitting projectId check and user owns it', async () => {
      prismaMock.planSnapshot.findUnique.mockResolvedValue({
        id: 1,
        project: { id: 20, userId: 100 } // No projectId passed, so it should only check userId
      } as any);

      const result = await editorRepository.verifySnapshotOwnership(1, 100);
      expect(result).toBe(true);
    });
  });
});
