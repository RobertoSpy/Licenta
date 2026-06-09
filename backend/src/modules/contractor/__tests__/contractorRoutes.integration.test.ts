import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../../../tests/setup';
import contractorRoutes from '../contractorRoutes';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// Mock jwt.verify to return specific users
jest.mock('jsonwebtoken');

// Adaugam ruta de contractor
app.use('/api/contractors', contractorRoutes);

describe('Contractor Routes (Integration)', () => {
  let tokenClient: string;
  let tokenContractor: string;

  beforeAll(() => {
    tokenClient = 'valid-client-token';
    tokenContractor = 'valid-contractor-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (jwt.verify as jest.Mock).mockImplementation((token) => {
      if (token === tokenClient) return { id: 10, role: 'CLIENT' };
      if (token === tokenContractor) return { id: 20, role: 'CONTRACTOR' };
      throw new Error('Invalid token');
    });

    // Mockam un utilizator in baza de date ca sa treaca de authMiddleware
    prismaMock.user.findUnique.mockImplementation((async (args: any) => {
      if (args.where.id === 10) return { id: 10, role: 'CLIENT', status: 'ACTIVE' } as any;
      if (args.where.id === 20) return { id: 20, role: 'CONTRACTOR', status: 'ACTIVE' } as any;
      return null;
    }) as any);
  });

  describe('Authorization and Roles', () => {
    it('GET /me/profile returns 401 without token', async () => {
      const res = await request(app).get('/api/contractors/me/profile');
      expect(res.status).toBe(401);
    });

    it('GET /me/profile returns 403 for CLIENT (requires CONTRACTOR)', async () => {
      const res = await request(app)
        .get('/api/contractors/me/profile')
        .set('Authorization', `Bearer ${tokenClient}`);
      expect(res.status).toBe(403);
    });

    it('POST /1/reviews returns 403 for CONTRACTOR (requires CLIENT)', async () => {
      const res = await request(app)
        .post('/api/contractors/1/reviews')
        .set('Authorization', `Bearer ${tokenContractor}`)
        .send({ rating: 5, comment: 'Good', projectId: 100 });
      expect(res.status).toBe(403);
    });
  });

  describe('Validation', () => {
    it('POST /:id/reviews returns 400 for invalid rating', async () => {
      const res = await request(app)
        .post('/api/contractors/1/reviews')
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ rating: 6, comment: 'Good', projectId: 100 });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Rating invalid');

      const resZero = await request(app)
        .post('/api/contractors/1/reviews')
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ rating: 0, comment: 'Good', projectId: 100 });
      expect(resZero.status).toBe(400);

      const resFloat = await request(app)
        .post('/api/contractors/1/reviews')
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ rating: 4.5, comment: 'Good', projectId: 100 });
      expect(resFloat.status).toBe(400);
    });

    it('POST /:id/reviews returns 400 for empty or too long comment', async () => {
      const resEmpty = await request(app)
        .post('/api/contractors/1/reviews')
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ rating: 5, comment: '   ', projectId: 100 });
      
      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.message).toBe('Comentariu invalid');

      const resLong = await request(app)
        .post('/api/contractors/1/reviews')
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ rating: 5, comment: 'a'.repeat(1001), projectId: 100 });
      
      expect(resLong.status).toBe(400);
    });

    it('POST /:id/reviews returns 400 for invalid projectId', async () => {
      const res = await request(app)
        .post('/api/contractors/1/reviews')
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ rating: 5, comment: 'Good', projectId: 'abc' });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Proiectul trebuie specificat');
    });

    it('GET /:id returns 400 for invalid contractorId (NaN)', async () => {
      const res = await request(app)
        .get('/api/contractors/abc')
        .set('Authorization', `Bearer ${tokenClient}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Happy Paths', () => {
    it('GET /me/profile returns 200 for CONTRACTOR', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 1, companyName: 'Test' } as any);
      const res = await request(app)
        .get('/api/contractors/me/profile')
        .set('Authorization', `Bearer ${tokenContractor}`);
      
      expect(res.status).toBe(200);
      expect(res.body.companyName).toBe('Test');
    });

    it('POST /:id/reviews returns 200 on success', async () => {
      // Mock quote checking
      prismaMock.contractorQuote.findFirst.mockResolvedValue({ id: 1, status: 'ACCEPTED' } as any);
      // Mock duplicate checking
      prismaMock.contractorReview.findFirst.mockResolvedValue(null);
      // Mock review creation
      prismaMock.contractorReview.create.mockResolvedValue({ id: 1, rating: 5 } as any);
      // Mock avgRating recalc
      prismaMock.contractorReview.findMany.mockResolvedValue([{ rating: 5 } as any]);
      // Mock update
      prismaMock.contractorProfile.update.mockResolvedValue({ id: 1 } as any);

      const res = await request(app)
        .post('/api/contractors/1/reviews')
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ rating: 5, comment: 'Super', projectId: 100 });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
