import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../../../tests/setup';
import constructionRoutes from '../constructionRoutes';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/construction', constructionRoutes);

describe('Construction Routes (Integration)', () => {
  const validSecret = process.env.JWT_ACCESS_SECRET as string;
  let tokenUser1: string;
  let tokenUser2: string;

  beforeAll(() => {
    tokenUser1 = 'valid-token-1';
    tokenUser2 = 'valid-token-2';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup valid JWT decoding
    (jwt.verify as jest.Mock).mockImplementation((token: string) => {
      if (token === tokenUser1) return { id: 1 };
      if (token === tokenUser2) return { id: 2 };
      throw new Error('invalid token');
    });

    // Default setup for project 1 owned by user 1
    prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 1, publishedSnapshotId: 10 } as any);
    prismaMock.user.findUnique.mockResolvedValue({ id: 1, role: 'CLIENT' } as any);
  });

  describe('Security & TenantGuard', () => {
    it('GET /:projectId without token returns 401', async () => {
      const res = await request(app).get('/api/construction/1');
      expect(res.status).toBe(401);
    });

    it('GET /:projectId by non-owner returns 403', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 2, role: 'CLIENT' } as any);
      
      const res = await request(app)
        .get('/api/construction/1')
        .set('Authorization', `Bearer ${tokenUser2}`);
        
      expect(res.status).toBe(403);
    });

    it('PATCH /:projectId/phase/:phaseOrder/complete by non-owner returns 403', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 2, role: 'CLIENT' } as any);
      
      const res = await request(app)
        .patch('/api/construction/1/phase/1/complete')
        .set('Authorization', `Bearer ${tokenUser2}`);
        
      expect(res.status).toBe(403);
    });
  });

  describe('Input Validation', () => {
    it('PATCH with invalid types returns 400', async () => {
      const res = await request(app)
        .patch('/api/construction/abc/phase/def/complete')
        .set('Authorization', `Bearer ${tokenUser1}`);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('ID proiect invalid sau lipsă.');
    });

    it('PATCH with phaseOrder=0 returns 400', async () => {
      const res = await request(app)
        .patch('/api/construction/1/phase/0/complete')
        .set('Authorization', `Bearer ${tokenUser1}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Parametri invalizi');
    });

    it('PATCH with phaseOrder=-1 returns 400', async () => {
      const res = await request(app)
        .patch('/api/construction/1/phase/-1/complete')
        .set('Authorization', `Bearer ${tokenUser1}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Parametri invalizi');
    });
  });

  describe('Business Logic Errors', () => {
    const mockPhases = [
      { id: 10, phaseOrder: 1, isCompleted: true },
      { id: 11, phaseOrder: 2, isCompleted: false }
    ];

    it('PATCH on nonexistent phaseOrder (e.g. 99) returns 404', async () => {
      prismaMock.constructionPhase.findMany.mockResolvedValue(mockPhases as any);

      const res = await request(app)
        .patch('/api/construction/1/phase/99/complete')
        .set('Authorization', `Bearer ${tokenUser1}`);
        
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Faza nu exista');
    });

    it('PATCH on phase with uncompleted prerequisite returns 409', async () => {
      // Trying to complete phase 3 when phase 2 is uncompleted
      const phases = [...mockPhases, { id: 12, phaseOrder: 3, isCompleted: false }];
      prismaMock.constructionPhase.findMany.mockResolvedValue(phases as any);

      const res = await request(app)
        .patch('/api/construction/1/phase/3/complete')
        .set('Authorization', `Bearer ${tokenUser1}`);
        
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Faza anterioara nu este completata');
    });

    it('GET when project has no published PlanSnapshot returns 400', async () => {
      // Mock db returns no phases
      prismaMock.constructionPhase.findMany.mockResolvedValue([]);
      // Mock project repository (which will be used by generatePhasesForProject and tenantGuard)
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 1, publishedSnapshotId: null } as any);

      const res = await request(app)
        .get('/api/construction/1')
        .set('Authorization', `Bearer ${tokenUser1}`);
        
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Proiectul nu are un plan publicat');
    });
  });

  describe('Happy Paths', () => {
    const mockPhases = [
      { id: 10, phaseOrder: 1, isCompleted: true },
      { id: 11, phaseOrder: 2, isCompleted: false }
    ];

    it('PATCH complete returns updated phase object', async () => {
      prismaMock.constructionPhase.findMany.mockResolvedValue(mockPhases as any);
      
      const updatedPhase = { id: 11, phaseOrder: 2, isCompleted: true };
      prismaMock.constructionPhase.update.mockResolvedValue(updatedPhase as any);

      const res = await request(app)
        .patch('/api/construction/1/phase/2/complete')
        .set('Authorization', `Bearer ${tokenUser1}`);
        
      expect(res.status).toBe(200);
      expect(res.body).toEqual(updatedPhase); // Important for frontend UI updates
    });

    it('GET returns phases array', async () => {
      prismaMock.constructionPhase.findMany.mockResolvedValue(mockPhases as any);

      const res = await request(app)
        .get('/api/construction/1')
        .set('Authorization', `Bearer ${tokenUser1}`);
        
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPhases);
    });
  });
});
