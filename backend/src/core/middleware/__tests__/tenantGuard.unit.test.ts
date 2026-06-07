import { tenantGuard } from '../tenantGuard';
import { projectRepository } from '../../../modules/project/projectRepository';

jest.mock('../../../modules/project/projectRepository');

describe('tenantGuard (unit)', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = { params: {}, body: {}, user: { id: 1 } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('returns 400 when projectId param is present but non-numeric (NaN after parseInt)', async () => {
    req.params.projectId = 'abc';
    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'ID proiect invalid sau lipsă.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not make DB call when projectId is NaN (fails fast)', async () => {
    req.params.id = 'invalid';
    await tenantGuard(req, res, next);

    expect(projectRepository.findById).not.toHaveBeenCalled();
  });

  it('returns 403, not 404, when project exists but belongs to different user', async () => {
    req.params.projectId = '100';
    req.user.id = 1;
    // Mock returnează un proiect valid dar cu userId diferit
    (projectRepository.findById as jest.Mock).mockResolvedValue({ id: 100, userId: 999, title: 'Secret Project' });

    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.project with full project object, not just id', async () => {
    req.params.projectId = '100';
    req.user.id = 1;
    const mockProject = { id: 100, userId: 1, title: 'My Project', description: 'Desc' };
    (projectRepository.findById as jest.Mock).mockResolvedValue(mockProject);

    await tenantGuard(req, res, next);

    expect(req.project).toEqual(mockProject);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('works correctly when req.user is set by authMiddleware (dependency order)', async () => {
    // Simulăm fix flow-ul unde authMiddleware a populat req.user
    req.user = { id: 42, role: 'CLIENT' };
    req.params.id = '100';
    const mockProject = { id: 100, userId: 42, title: 'My Project' };
    (projectRepository.findById as jest.Mock).mockResolvedValue(mockProject);

    await tenantGuard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
