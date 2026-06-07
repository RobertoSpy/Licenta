import request from 'supertest';
import express from 'express';
import terrainRoutes from '../terrainRoutes';
import { redisClient } from '../../../lib/redis';

const app = express();
app.use(express.json());

// Mocam serviciul geospatial ca sa nu faca call-uri HTTP la API-uri externe in timpul testelor
jest.mock('../geospatialService', () => ({
  geospatialService: {
    reverseGeocode: jest.fn().mockResolvedValue({ county: 'Bucuresti', locality: 'Sector 1' }),
    getSeismicZone: jest.fn().mockReturnValue({ ag: '0.30g', Tc: '1.6s' }),
    getFrostDepth: jest.fn().mockReturnValue(90)
  }
}));

app.use('/api/terrain', terrainRoutes);

describe('Terrain & Geospatial API (Integration)', () => {
  afterAll(async () => {
    // Dacă am importat redisClient în teste (chiar dacă nu îl folosim activ aici), 
    // e o bună practică să închidem conexiunea ca să evităm "open handles".
    if (redisClient) {
      await redisClient.quit();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('screen1Schema Validation', () => {
    it('returns 400 when body is completely empty', async () => {
      const res = await request(app).post('/api/terrain/analyze-location').send({});
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('returns 400 when lat is provided without lng', async () => {
      const res = await request(app).post('/api/terrain/analyze-location').send({ projectId: 1, lat: 44.4 });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].message).toContain('Latitudinea și longitudinea trebuie');
    });

    it('returns 400 when lng is provided without lat', async () => {
      const res = await request(app).post('/api/terrain/analyze-location').send({ projectId: 1, lng: 26.1 });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].message).toContain('Latitudinea și longitudinea trebuie');
    });

    it('returns 200 when only county is provided (no coordinates)', async () => {
      const res = await request(app).post('/api/terrain/analyze-location').send({ projectId: 1, county: 'Cluj' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.county).toBe('Cluj');
    });

    it('returns 200 when only lat+lng are provided (no county)', async () => {
      const res = await request(app).post('/api/terrain/analyze-location').send({ projectId: 1, lat: 44.4, lng: 26.1 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.county).toBe('Bucuresti'); // Din mock-ul reverseGeocode
    });
  });

  it('POST /api/terrain/analyze-location - success flow with all valid data', async () => {
    const res = await request(app)
      .post('/api/terrain/analyze-location')
      .send({
        projectId: 1,
        lat: 44.4268,
        lng: 26.1025,
        polygon: []
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.county).toBe('Bucuresti');
    expect(res.body.data.seismicZone).toBe('0.30g');
    expect(res.body.data.frostDepthCm).toBe(90);
  });
});
