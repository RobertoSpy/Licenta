import request from 'supertest';
import express from 'express';
import { prismaMock } from '../setup';
import quoteRoutes from '../../src/modules/quote/quoteRoutes';
import { AuthRequest } from '../../src/core/middleware/authMiddleware';

// Creăm o versiune minimală a aplicației pentru testul de integrare
const app = express();
app.use(express.json());

// Mocam middleware-ul de auth
jest.mock('../../src/core/middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    // Dacă testul nu a setat manual user-ul, setăm noi unul generic de CLIENT
    if (!req.user) {
      req.user = { id: 100, role: 'CLIENT' };
    }
    next();
  }
}));

jest.mock('../../src/core/middleware/roleMiddleware', () => ({
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

describe('Quote API Routes (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/quotes/request - Ar trebui ca un Client sa poata lansa cereri catre constructori', async () => {
    // Mocking la baza de date pentru acest flux
    prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 100 } as any);
    prismaMock.contractorQuote.findMany.mockResolvedValue([]);
    
    // Simulam gasirea a 2 constructori (ID 50 si 51) si crearea a 2 cotații PENDING
    prismaMock.user.findMany.mockResolvedValue([{ id: 50 }, { id: 51 }] as any);
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

  it('POST /api/quotes/request - Ar trebui sa returneze 403 Forbidden daca incearca un Constructor', async () => {
    // Mocam un request care vine de la un Constructor
    app.use('/api/quotes_test_fail', (req: any, res, next) => {
      req.user = { id: 50, role: 'CONTRACTOR' };
      next();
    }, quoteRoutes);

    const response = await request(app)
      .post('/api/quotes_test_fail/request')
      .send({ projectId: 1, contractorIds: [50] });

    expect(response.status).toBe(403);
  });
});
