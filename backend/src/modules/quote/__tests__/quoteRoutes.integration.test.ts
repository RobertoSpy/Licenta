import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../../../tests/setup';
import quoteRoutes from '../quoteRoutes';

const app = express();
app.use(express.json());

// Mockauth pentru CLIENT by default
app.use('/api/quotes', (req: any, res, next) => {
  if (!req.user) {
    req.user = { id: 100, role: 'CLIENT' };
  }
  next();
});

jest.mock('../../../core/middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => next()
}));

jest.mock('../../../core/middleware/roleMiddleware', () => ({
  requireRole: (allowedRoles: string | string[]) => (req: any, res: any, next: any) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden' });
    }
  }
}));

app.use('/api/quotes', quoteRoutes);

// Setup a separate path for CONTRACTOR testing
const contractorApp = express();
contractorApp.use(express.json());
contractorApp.use('/api/quotes', (req: any, res, next) => {
  req.user = { id: 50, role: 'CONTRACTOR' };
  next();
});
contractorApp.use('/api/quotes', quoteRoutes);

describe('Quote API Routes (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RBAC Cross-Role Enforcement', () => {
    it('CLIENT cannot POST /quotes/:id/submit (403)', async () => {
      const res = await request(app).post('/api/quotes/1/submit').send({ totalAmount: 100 });
      expect(res.status).toBe(403);
    });

    it('CONTRACTOR cannot POST /quotes/:id/accept (403)', async () => {
      const res = await request(contractorApp).post('/api/quotes/1/accept');
      expect(res.status).toBe(403);
    });

    it('CONTRACTOR cannot GET /quotes/project/:projectId (403)', async () => {
      const res = await request(contractorApp).get('/api/quotes/project/1');
      expect(res.status).toBe(403);
    });

    it('CLIENT cannot GET /quotes/contractor (403)', async () => {
      const res = await request(app).get('/api/quotes/contractor');
      expect(res.status).toBe(403);
    });
    
    it('CONTRACTOR cannot POST /quotes/request (403)', async () => {
      const res = await request(contractorApp).post('/api/quotes/request').send({ projectId: 1, contractorIds: [50] });
      expect(res.status).toBe(403);
    });
  });

  describe('Client Routes', () => {
    it('POST /api/quotes/request - returns 201 when quotes are created', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] } as any);
      prismaMock.contractorProfile.findMany.mockResolvedValue([
        { id: 50, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
        { id: 51, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
      ] as any);
      prismaMock.contractorQuote.findMany.mockResolvedValue([]);
      prismaMock.contractorQuote.createMany.mockResolvedValue({ count: 2 } as any);

      const response = await request(app)
        .post('/api/quotes/request')
        .send({
          projectId: 1,
          contractorIds: [50, 51],
          message: 'Astept ofertele voastre!'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Cereri trimise cu succes.');
      expect(response.body.count).toBe(2);
    });

    it('GET /api/quotes/project/:projectId - returns 200 with quotes', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 100 } as any);
      prismaMock.contractorQuote.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }] as any);

      const response = await request(app).get('/api/quotes/project/1');
      
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    it('POST /api/quotes/:id/accept - returns 200 on success', async () => {
      prismaMock.contractorQuote.findUnique.mockResolvedValue({
        id: 1,
        projectId: 1,
        project: { userId: 100 },
        phases: [{ id: 101 }]
      } as any);

      prismaMock.$transaction.mockImplementation(async (cb) => {
        return { id: 1, status: 'ACCEPTED' };
      });

      const response = await request(app).post('/api/quotes/1/accept');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACCEPTED');
    });
  });

  describe('Contractor Routes', () => {
    it('GET /api/quotes/contractor - returns 200 with quotes', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 10, userId: 50 } as any);
      prismaMock.contractorQuote.findMany.mockResolvedValue([{ id: 1, contractorId: 10 }] as any);

      const response = await request(contractorApp).get('/api/quotes/contractor');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });

    it('POST /api/quotes/:id/submit - returns 200 on success', async () => {
      prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 10, userId: 50 } as any);
      prismaMock.contractorQuote.findUnique.mockResolvedValue({ id: 1, contractorId: 10, status: 'PENDING' } as any);
      prismaMock.contractorQuote.update.mockResolvedValue({ id: 1, status: 'SENT' } as any);

      const response = await request(contractorApp)
        .post('/api/quotes/1/submit')
        .send({ totalAmount: 1500, executionDays: 14, acceptsBOM: true });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('SENT');
    });
  });
});
