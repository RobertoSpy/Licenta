import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../../../tests/setup';
import editorRoutes from '../editorRoutes';
import jwt from 'jsonwebtoken';
import { agentOrchestrator } from '../../ai/services/agentOrchestrator';

const app = express();
app.use(express.json());

// Mock jwt.verify to return specific users
jest.mock('jsonwebtoken');

// Adaugam ruta de editor
app.use('/api/editor', editorRoutes);

describe('Editor Routes (Integration)', () => {
  let token: string;

  beforeAll(() => {
    token = 'valid-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 10, role: 'CLIENT' };
    });

    // Mockam un utilizator in baza de date
    (prismaMock.user.findUnique.mockImplementation as any)(async (args: any) => {
      if (args.where.id === 10) return { id: 10, role: 'CLIENT', status: 'ACTIVE' } as any;
      return null;
    });

    // Mockam tenantGuard prin projectRepository
    prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 10 } as any);
  });

  describe('Authorization and Validation', () => {
    it('GET /snapshots/:projectId returns 401 without token', async () => {
      const res = await request(app).get('/api/editor/snapshots/1');
      expect(res.status).toBe(401);
    });

    it('GET /snapshots/:projectId returns 400 for NaN projectId', async () => {
      const res = await request(app)
        .get('/api/editor/snapshots/abc')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('GET /snapshots/single/:id returns 400 for NaN snapshotId', async () => {
      const res = await request(app)
        .get('/api/editor/snapshots/single/abc')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('PATCH /snapshots/:id/publish returns 403 when ownership fails (cross-project ref)', async () => {
      // Mockam snapshot findUnique sa returneze un snapshot care nu ne apartine sau dintr-un alt proiect
      prismaMock.planSnapshot.findUnique.mockResolvedValue({
        id: 999,
        project: { id: 2, userId: 10 } // apartine userului, dar alt proiect (2 in loc de 1)
      } as any);

      const res = await request(app)
        .patch('/api/editor/snapshots/999/publish')
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId: 1 });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Acces interzis sau snapshot-ul nu aparține acestui proiect');
    });

    it('PATCH /snapshots/:id/publish does not expose which link failed (returns 403 on total failure)', async () => {
      prismaMock.planSnapshot.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/editor/snapshots/999/publish')
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId: 1 });

      expect(res.status).toBe(403);
    });
  });

  describe('SSE explain-conformity', () => {
    it('POST /explain-conformity returns 400 for empty violations array', async () => {
      const res = await request(app)
        .post('/api/editor/explain-conformity')
        .set('Authorization', `Bearer ${token}`)
        .send({ violations: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });

    it('POST /explain-conformity returns 400 for malformed violation', async () => {
      const res = await request(app)
        .post('/api/editor/explain-conformity')
        .set('Authorization', `Bearer ${token}`)
        .send({ violations: [{ label: 'test' }] }); // missing other fields

      expect(res.status).toBe(400);
    });

    it('POST /explain-conformity returns content-type text/event-stream and formats correctly', async () => {
      // Mock agentOrchestrator to yield dummy chunks
      async function* dummyStream() {
        yield { text: 'Hello' };
        yield { text: ' World' };
      }

      jest.spyOn(agentOrchestrator, 'getAiStreamForChat').mockResolvedValue(dummyStream());

      const response = await request(app)
        .post('/api/editor/explain-conformity')
        .set('Authorization', `Bearer ${token}`)
        .send({ violations: [{ label: 'Living', usableSqm: 16, minRequired: 18 }] })
        .buffer(true)
        .parse((res, callback) => {
          let data = '';
          res.on('data', chunk => { data += chunk.toString(); });
          res.on('end', () => callback(null, data));
        });

      expect(response.headers['content-type']).toContain('text/event-stream');
      
      const text = response.body as string;
      expect(text).toContain('data: {"text":"Hello"}\n\n');
      expect(text).toContain('data: {"text":" World"}\n\n');
      expect(text).toContain('data: [DONE]\n\n');
    });
  });
});
