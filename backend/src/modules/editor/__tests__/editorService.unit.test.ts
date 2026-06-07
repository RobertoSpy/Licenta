import { editorService } from '../editorService';
import { editorRepository } from '../editorRepository';

jest.mock('../editorRepository');

describe('Editor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('publishSnapshot', () => {
    it('invalidates existing BOM and sets other snapshots to false', async () => {
      // Setup mock return
      const mockPublishedSnapshot = { id: 1, isPublished: true };
      (editorRepository.publishSnapshot as jest.Mock).mockResolvedValue(mockPublishedSnapshot);

      const result = await editorService.publishSnapshot(1, 10);

      expect(editorRepository.publishSnapshot).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(mockPublishedSnapshot);
      // We rely on editorRepository testing for the DB details, but we document what happens
    });
  });

  describe('saveSnapshot', () => {
    it('creates snapshot and then triggers cleanup', async () => {
      (editorRepository.createSnapshot as jest.Mock).mockResolvedValue({ id: 1 });
      
      const result = await editorService.saveSnapshot(10, { data: 'test' }, 'parter', 'label');
      
      expect(editorRepository.createSnapshot).toHaveBeenCalledWith(10, { data: 'test' }, 'parter', 'label');
      expect(editorRepository.cleanupOldSnapshots).toHaveBeenCalledWith(10, 'parter');
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('Delegation methods', () => {
    it('listSnapshots delegates correctly', async () => {
      await editorService.listSnapshots(1, 'parter');
      expect(editorRepository.listSnapshots).toHaveBeenCalledWith(1, 'parter');
    });

    it('getSnapshot delegates correctly', async () => {
      await editorService.getSnapshot(1);
      expect(editorRepository.getSnapshot).toHaveBeenCalledWith(1);
    });

    it('verifySnapshotOwnership delegates correctly', async () => {
      await editorService.verifySnapshotOwnership(1, 10, 100);
      expect(editorRepository.verifySnapshotOwnership).toHaveBeenCalledWith(1, 10, 100);
    });

    it('getLatestSnapshot delegates correctly', async () => {
      await editorService.getLatestSnapshot(1, 'etaj1');
      expect(editorRepository.getLatestSnapshot).toHaveBeenCalledWith(1, 'etaj1');
    });

    it('deleteSnapshot delegates correctly', async () => {
      await editorService.deleteSnapshot(1);
      expect(editorRepository.deleteSnapshot).toHaveBeenCalledWith(1);
    });
  });
});
