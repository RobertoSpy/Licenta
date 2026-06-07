import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../../../tests/setup';
import marketRoutes from '../marketRoutes';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// Mock jwt
jest.mock('jsonwebtoken');

app.use('/api/market', marketRoutes);

describe('Market Routes (Integration)', () => {
  let token: string;

  beforeAll(() => {
    token = 'valid-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 10, role: 'CLIENT' };
    });

    (prismaMock.user.findUnique.mockImplementation as any)(async () => {
      return { id: 10, role: 'CLIENT', status: 'ACTIVE' } as any;
    });
  });

  it('GET /history returns 401 without token', async () => {
    const res = await request(app).get('/api/market/history');
    expect(res.status).toBe(401);
  });

  it('GET /forecast returns 422/500 when insufficient data points (< 2)', async () => {
    // 0 points returned
    prismaMock.marketIndexPoint.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/market/forecast')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    // Eroarea interna n-ar trebui expusă în obiect dacă n-am implementat middleware explicit
    // Dar măcar mesajul de la Controller e: "Eroare la generarea prognozei."
    expect(res.body.error).toBe('Eroare la generarea prognozei.');
    expect(res.body.message).toBeUndefined(); // internal error string is NOT exposed
  });

  it('GET /forecast returns 200 with fresh forecast when cache is corrupted', async () => {
    // Corrupted cache
    prismaMock.marketForecastCache.findFirst.mockResolvedValue({
      generatedAt: new Date().toISOString(), // fresh
      forecastJson: 'not a json'
    } as any);

    // Mock points for regression
    prismaMock.marketIndexPoint.findMany.mockResolvedValue([
      { year: 2026, month: 1, indexValue: 100 },
      { year: 2026, month: 2, indexValue: 110 }
    ] as any);

    // Mock upsert
    prismaMock.$transaction.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .get('/api/market/forecast')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.years).toBeDefined();
    expect(prismaMock.$transaction).toHaveBeenCalled(); // Means upsert was called
  });
});
