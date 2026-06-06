import request from 'supertest';
import express from 'express';
import { prismaMock } from '../setup';
import terrainRoutes from '../../src/modules/terrain/terrainRoutes';

const app = express();
app.use(express.json());

// Bypass la auth
jest.mock('../../src/core/middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    req.user = { id: 1 };
    next();
  }
}));

// Mocam serviciul geospatial ca sa nu faca call-uri HTTP la API-uri externe in timpul testelor
jest.mock('../../src/modules/terrain/geospatialService', () => ({
  geospatialService: {
    reverseGeocode: jest.fn().mockResolvedValue({ county: 'Bucuresti', locality: 'Sector 1' }),
    getSeismicZone: jest.fn().mockReturnValue({ ag: '0.30g', Tc: '1.6s' }),
    getFrostDepth: jest.fn().mockReturnValue(90)
  }
}));

app.use('/api/terrain', terrainRoutes);

describe('Terrain & Geospatial API (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/terrain - ar trebui sa creeze o intrare in DB pentru teren', async () => {
    // Simulăm actualizarea proiectului cu noile coordonate GPS
    prismaMock.project.update.mockResolvedValue({
      id: 1,
      lat: 44.4268,
      lng: 26.1025,
      polygonGeoJSON: []
    } as any);

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
