import express from 'express';
import request from 'supertest';
import terrainRouter from '../../../src/modules/terrain/terrainRoutes';
import axios from 'axios';

jest.mock('axios');
jest.mock('../../../src/lib/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK')
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('terrain integration', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/terrain', terrainRouter);
  });

  it('POST /api/terrain/analyze-location returns data for coords', async () => {
    mockedAxios.get.mockResolvedValue({ data: { address: { county: 'Județul Cluj', village: 'TestTown' } } });

    const res = await request(app)
      .post('/api/terrain/analyze-location')
      .send({ lat: 46.77, lng: 23.59 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.county.toLowerCase()).toContain('cluj');
    expect(res.body.data.locality).toBe('TestTown');
  });
});
