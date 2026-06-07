import { Request, Response } from 'express';
import { AuthRequest } from '../../../core/middleware/authMiddleware';
import { createProject, getUserProjects, getProjectById, updateProject, deleteProject } from '../projectController';
import { projectService } from '../projectService';

jest.mock('../projectService');

describe('Project Controller', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      user: { id: 1, role: 'CLIENT' },
      body: {},
      params: {}
    };
    res = {
      status: statusMock,
      json: jsonMock,
    };
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('createProject', () => {
    it('returns 201 and created project', async () => {
      req.body = { title: 'Test' };
      (projectService.createProject as jest.Mock).mockResolvedValue({ id: 1, title: 'Test' });

      await createProject(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ id: 1, title: 'Test' });
      expect(projectService.createProject).toHaveBeenCalledWith(1, 'Test');
    });

    it('returns 201 with default title if missing', async () => {
      (projectService.createProject as jest.Mock).mockResolvedValue({ id: 1 });

      await createProject(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(projectService.createProject).toHaveBeenCalledWith(1, expect.stringContaining('Proiect nou -'));
    });

    it('returns 500 on error', async () => {
      (projectService.createProject as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await createProject(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Eroare la crearea proiectului' });
    });
  });

  describe('getUserProjects', () => {
    it('returns 200 and projects list', async () => {
      (projectService.getUserProjects as jest.Mock).mockResolvedValue([{ id: 1 }]);

      await getUserProjects(req as AuthRequest, res as Response);

      expect(jsonMock).toHaveBeenCalledWith([{ id: 1 }]);
      expect(projectService.getUserProjects).toHaveBeenCalledWith(1);
    });

    it('returns 500 on error', async () => {
      (projectService.getUserProjects as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await getUserProjects(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Eroare la preluarea proiectelor' });
    });
  });

  describe('getProjectById', () => {
    it('returns 200 and project attached by tenantGuard', async () => {
      req.project = { id: 1, title: 'Test' } as any;

      await getProjectById(req as AuthRequest, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({ id: 1, title: 'Test' });
    });
  });

  describe('updateProject', () => {
    it('returns 200 and updated project', async () => {
      req.params = { id: '1' };
      req.body = { title: 'Updated' };
      req.project = { id: 1 } as any;
      (projectService.updateProject as jest.Mock).mockResolvedValue({ id: 1, title: 'Updated' });

      await updateProject(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ id: 1, title: 'Updated' });
      expect(projectService.updateProject).toHaveBeenCalledWith(1, { title: 'Updated' }, { id: 1 });
    });

    it('returns 404 when NOT_FOUND thrown', async () => {
      req.params = { id: '1' };
      (projectService.updateProject as jest.Mock).mockRejectedValue(new Error('NOT_FOUND'));

      await updateProject(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Proiectul nu a fost găsit' });
    });

    it('returns 500 on other errors', async () => {
      req.params = { id: '1' };
      (projectService.updateProject as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await updateProject(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Eroare la actualizarea proiectului' });
    });
  });

  describe('deleteProject', () => {
    it('returns 200 on success', async () => {
      req.params = { id: '1' };
      (projectService.deleteProject as jest.Mock).mockResolvedValue(undefined);

      await deleteProject(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Proiect șters cu succes' });
      expect(projectService.deleteProject).toHaveBeenCalledWith(1);
    });

    it('returns 500 on error', async () => {
      req.params = { id: '1' };
      (projectService.deleteProject as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await deleteProject(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Eroare la ștergerea proiectului' });
    });
  });
});
