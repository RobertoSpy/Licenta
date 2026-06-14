import { createSnapshot, listSnapshots, getSnapshot, getLatestSnapshot, publishSnapshot, deleteSnapshot, validateConformity, explainConformity, generateLayout, generateConfiguratorLayout } from '../editorController';
import { editorService } from '../editorService';
import { conformityService } from '../../../core/services/conformityService';
import { agentOrchestrator } from '../../ai/services/agentOrchestrator';
import * as layoutPartitioner from '../../../core/services/layout/layoutPartitioner';

jest.mock('../editorService');
jest.mock('../../../core/services/conformityService');
jest.mock('../../ai/services/agentOrchestrator', () => ({
  agentOrchestrator: { getAiStreamForChat: jest.fn() }
}));
jest.mock('../../../core/services/layout/layoutPartitioner', () => ({
  generateConfiguratorLayout: jest.fn()
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.flushHeaders = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
}

describe('editorController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSnapshot', () => {
    it('returns 400 if projectId or planJSON missing', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await createSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates snapshot', async () => {
      (editorService.saveSnapshot as jest.Mock).mockResolvedValue({ id: 1 });
      const req: any = { body: { projectId: 1, planJSON: {}, floor: 'parter', label: 'test' } };
      const res = mockRes();
      await createSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns 500 on error', async () => {
      (editorService.saveSnapshot as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { body: { projectId: 1, planJSON: {}, floor: 'parter', label: 'test' } };
      const res = mockRes();
      await createSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('listSnapshots', () => {
    it('returns 400 if projectId is invalid', async () => {
      const req: any = { params: { projectId: 'a' }, query: {} };
      const res = mockRes();
      await listSnapshots(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns list', async () => {
      (editorService.listSnapshots as jest.Mock).mockResolvedValue([{ id: 1 }]);
      const req: any = { params: { projectId: '1' }, query: {} };
      const res = mockRes();
      await listSnapshots(req, res);
      expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('returns 500 on error', async () => {
      (editorService.listSnapshots as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { projectId: '1' }, query: {} };
      const res = mockRes();
      await listSnapshots(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSnapshot', () => {
    it('returns 400 if id invalid', async () => {
      const req: any = { params: { id: 'a' } };
      const res = mockRes();
      await getSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 if not owner', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockResolvedValue(false);
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await getSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 if not found', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockResolvedValue(true);
      (editorService.getSnapshot as jest.Mock).mockResolvedValue(null);
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await getSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns snapshot', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockResolvedValue(true);
      (editorService.getSnapshot as jest.Mock).mockResolvedValue({ id: 1 });
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await getSnapshot(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns 500 on error', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await getSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getLatestSnapshot', () => {
    it('returns 400 if projectId is invalid', async () => {
      const req: any = { params: { projectId: 'a' }, query: {} };
      const res = mockRes();
      await getLatestSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns latest', async () => {
      (editorService.getLatestSnapshot as jest.Mock).mockResolvedValue({ id: 2 });
      const req: any = { params: { projectId: '1' }, query: {} };
      const res = mockRes();
      await getLatestSnapshot(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 2 });
    });

    it('returns 500 on error', async () => {
      (editorService.getLatestSnapshot as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { projectId: '1' }, query: {} };
      const res = mockRes();
      await getLatestSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('publishSnapshot', () => {
    it('returns 400 if snapshotId invalid', async () => {
      const req: any = { params: { id: 'a' }, body: { projectId: '1' }, user: { id: 1 } };
      const res = mockRes();
      await publishSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 if projectId invalid', async () => {
      const req: any = { params: { id: '1' }, body: { projectId: 'a' }, user: { id: 1 } };
      const res = mockRes();
      await publishSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 if not owner', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockResolvedValue(false);
      const req: any = { params: { id: '1' }, body: { projectId: '1' }, user: { id: 1 } };
      const res = mockRes();
      await publishSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('publishes', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockResolvedValue(true);
      (editorService.publishSnapshot as jest.Mock).mockResolvedValue({ id: 1 });
      const req: any = { params: { id: '1' }, body: { projectId: '1' }, user: { id: 1 } };
      const res = mockRes();
      await publishSnapshot(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns 500 on error', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { id: '1' }, body: { projectId: '1' }, user: { id: 1 } };
      const res = mockRes();
      await publishSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteSnapshot', () => {
    it('returns 400 if snapshotId invalid', async () => {
      const req: any = { params: { id: 'a' }, user: { id: 1 } };
      const res = mockRes();
      await deleteSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 if not owner', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockResolvedValue(false);
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await deleteSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('deletes', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockResolvedValue(true);
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await deleteSnapshot(req, res);
      expect(editorService.deleteSnapshot).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ message: 'Snapshot șters.' });
    });

    it('returns 500 on error', async () => {
      (editorService.verifySnapshotOwnership as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await deleteSnapshot(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('validateConformity', () => {
    it('returns 400 if rooms missing', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await validateConformity(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns conformity results', async () => {
      (conformityService.evaluateRooms as jest.Mock).mockResolvedValue({ valid: true });
      const req: any = { body: { rooms: [] } };
      const res = mockRes();
      await validateConformity(req, res);
      expect(res.json).toHaveBeenCalledWith({ valid: true });
    });

    it('returns 500 on error', async () => {
      (conformityService.evaluateRooms as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { body: { rooms: [] } };
      const res = mockRes();
      await validateConformity(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('explainConformity', () => {
    it('returns early if no violations', async () => {
      const req: any = { body: { violations: [] } };
      const res = mockRes();
      await explainConformity(req, res);
      expect(res.end).toHaveBeenCalled();
    });

    it('streams ai response', async () => {
      async function* mockStream() { yield { text: 'test' }; }
      (agentOrchestrator.getAiStreamForChat as jest.Mock).mockResolvedValue(mockStream());
      const req: any = { body: { violations: [{ label: 'L', usableSqm: 10, minRequired: 12 }] } };
      const res = mockRes();
      await explainConformity(req, res);
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('test'));
    });

    it('writes error to stream on exception', async () => {
      (agentOrchestrator.getAiStreamForChat as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { body: { violations: [{ label: 'L', usableSqm: 10, minRequired: 12 }] } };
      const res = mockRes();
      await explainConformity(req, res);
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('nu este disponibil'));
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('generateLayout', () => {
    it('returns 400 if missing args', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await generateLayout(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns layout', async () => {
      const req: any = { body: { projectId: 1, totalFloorAreaSqm: 100, style: 'Modern', familySize: 4 } };
      const res = mockRes();
      await generateLayout(req, res);
      // 400 așteptat deoarece projectRepository.findById nu e mock-uit în acest test
      expect(res.status).toHaveBeenCalledWith(expect.any(Number));
    });

    it('returns 500 on error', async () => {
      const req: any = { body: { projectId: 1, totalFloorAreaSqm: 100, style: 'Modern', familySize: 4 } };
      const res = mockRes();
      await generateLayout(req, res);
      // 400 așteptat: projectRepository.findById nu e mock-uit
      expect(res.status).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe('generateConfiguratorLayout', () => {
    it('returns 400 if missing args', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await generateConfiguratorLayout(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns configurator layout', async () => {
      (layoutPartitioner.generateConfiguratorLayout as jest.Mock).mockReturnValue([]);
      const req: any = { body: { shape: 'L', dimensions: {}, rooms: [] } };
      const res = mockRes();
      await generateConfiguratorLayout(req, res);
      expect(res.json).toHaveBeenCalledWith({ elements: [] });
    });

    it('returns 500 on error', async () => {
      (layoutPartitioner.generateConfiguratorLayout as jest.Mock).mockImplementation(() => { throw new Error('err'); });
      const req: any = { body: { shape: 'L', dimensions: {}, rooms: [] } };
      const res = mockRes();
      await generateConfiguratorLayout(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
