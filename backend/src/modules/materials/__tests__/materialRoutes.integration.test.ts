import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../../../tests/setup';
import materialRoutes from '../materialRoutes';

const app = express();
app.use(express.json());

// Bypass la JWT pentru a mentine mediul de test curat si izolat
jest.mock('../../../core/middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    req.user = { id: 1, role: 'CLIENT' };
    next();
  }
}));

app.use('/api/materials', materialRoutes);

describe('Material Module API (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/materials - Ar trebui sa returneze tot catalogul de materiale', async () => {
    // Mocam un rand de baza de date cu un material
    prismaMock.material.findMany.mockResolvedValue([
      { id: 1, internalCode: 'BET-C20', name: 'Beton C20/25', category: 'Beton', pricePerUnit: 350 } as any
    ]);

    const res = await request(app).get('/api/materials');
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].internalCode).toBe('BET-C20');
  });

  it('GET /api/materials/:code/alternatives - Ar trebui sa gaseasca alternative conform normativului', async () => {
    // Returnam un material premium ca alternativă
    prismaMock.material.findUnique.mockResolvedValue({
      id: 2, 
      internalCode: 'BET-C20',
      alternatives: [
        { id: 3, internalCode: 'BET-C25', name: 'Beton C25/30', budgetCategory: 'premium', pricePerUnit: 400 }
      ]
    } as any);

    const res = await request(app).get('/api/materials/BET-C20/alternatives');
    
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].budgetCategory).toBe('premium');
  });
});
