import { getPhases, completePhase } from '../constructionController';
import { constructionService } from '../constructionService';

jest.mock('../constructionService');

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('constructionController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPhases', () => {
    it('returns 400 if projectId is invalid', async () => {
      const req: any = { params: { projectId: 'abc' } };
      const res = mockRes();
      await getPhases(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 if project has no published snapshot', async () => {
      const req: any = { params: { projectId: '1' }, project: { publishedSnapshotId: null } };
      const res = mockRes();
      await getPhases(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 500 if MISSING_JSON_FILE', async () => {
      const req: any = { params: { projectId: '1' }, project: { publishedSnapshotId: 10 } };
      const res = mockRes();
      (constructionService.getProjectPhases as jest.Mock).mockRejectedValue(new Error('MISSING_JSON_FILE'));
      await getPhases(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Eroare la configuratia fazelor' });
    });

    it('returns 500 for generic error', async () => {
      const req: any = { params: { projectId: '1' }, project: { publishedSnapshotId: 10 } };
      const res = mockRes();
      (constructionService.getProjectPhases as jest.Mock).mockRejectedValue(new Error('OTHER_ERROR'));
      await getPhases(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Eroare la preluare etape' });
    });

    it('returns phases on success', async () => {
      const req: any = { params: { projectId: '1' }, project: { publishedSnapshotId: 10 } };
      const res = mockRes();
      (constructionService.getProjectPhases as jest.Mock).mockResolvedValue([{ id: 1 }]);
      await getPhases(req, res);
      expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });
  });

  describe('completePhase', () => {
    it('returns 400 for invalid params', async () => {
      const req: any = { params: { projectId: 'a', phaseOrder: '0' } };
      const res = mockRes();
      await completePhase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 if PHASE_NOT_FOUND', async () => {
      const req: any = { params: { projectId: '1', phaseOrder: '5' } };
      const res = mockRes();
      (constructionService.completePhase as jest.Mock).mockRejectedValue(new Error('PHASE_NOT_FOUND'));
      await completePhase(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 if PREREQUISITE_NOT_COMPLETED', async () => {
      const req: any = { params: { projectId: '1', phaseOrder: '5' } };
      const res = mockRes();
      (constructionService.completePhase as jest.Mock).mockRejectedValue(new Error('PREREQUISITE_NOT_COMPLETED'));
      await completePhase(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('returns 500 for generic error', async () => {
      const req: any = { params: { projectId: '1', phaseOrder: '5' } };
      const res = mockRes();
      (constructionService.completePhase as jest.Mock).mockRejectedValue(new Error('OTHER_ERROR'));
      await completePhase(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('returns updated on success', async () => {
      const req: any = { params: { projectId: '1', phaseOrder: '5' } };
      const res = mockRes();
      (constructionService.completePhase as jest.Mock).mockResolvedValue({ id: 5 });
      await completePhase(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 5 });
    });
  });
});
