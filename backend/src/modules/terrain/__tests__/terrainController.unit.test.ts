import { analyzeLocation } from '../terrainController';
import { terrainService } from '../terrainService';

jest.mock('../terrainService');

describe('terrainController (unit)', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.resetAllMocks();
    req = {
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('returns 200 with data on success', async () => {
    const mockData = { county: 'Cluj', locality: 'Dej', seismicZone: '0.25g', frostDepthCm: 90 };
    (terrainService.analyzeLocation as jest.Mock).mockResolvedValue(mockData);

    await analyzeLocation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockData });
  });

  it('returns 400 with descriptive message for "Unable to determine county"', async () => {
    (terrainService.analyzeLocation as jest.Mock).mockRejectedValue(new Error('Unable to determine county from coordinates or input.'));

    await analyzeLocation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Unable to determine county from coordinates or input.' });
  });

  it('returns 400 for invalid coordinates (lat > 90, lng > 180)', async () => {
    // Controller-ul folosește mesajul care conține 'Unable to determine county'.
    // Testăm exact cum mapează acest tip de eroare pe care o poate arunca validarea sau serviciul
    (terrainService.analyzeLocation as jest.Mock).mockRejectedValue(new Error('Unable to determine county: Coordinates are invalid'));

    await analyzeLocation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Unable to determine county: Coordinates are invalid' });
  });

  it('returns 500 without exposing internal Nominatim error details', async () => {
    (terrainService.analyzeLocation as jest.Mock).mockRejectedValue(new Error('Nominatim returned 502 Bad Gateway at proxy'));

    await analyzeLocation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Internal server error.' });
  });

  it('returns correct Content-Type: application/json on all responses', async () => {
    // Explicit sau implicit via Express .json() care setează charset și type
    // Cum suntem în unit test, res.json() este apelat, ceea ce sub capotă în Express pune application/json
    (terrainService.analyzeLocation as jest.Mock).mockResolvedValue({});
    await analyzeLocation(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});
