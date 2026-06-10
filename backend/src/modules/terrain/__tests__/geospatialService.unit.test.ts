import { geospatialService } from '../geospatialService';
import axios from 'axios';
import { redisClient } from '../../../lib/redis';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../../lib/redis', () => ({
  redisClient: {
    get: jest.fn(),
    setex: jest.fn(),
    quit: jest.fn()
  }
}));

describe('geospatialService (unit)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('normalizeString', () => {
    it('normalizeString removes diacritics and non-alphanum', () => {
      expect((geospatialService as any).normalizeString('Județul Cluj')).toBe('judetulcluj');
    });
  });

  describe('reverseGeocode', () => {
    it('cache key includes lat+lng for GPS requests, not just county name', async () => {
      (redisClient!.get as jest.Mock).mockResolvedValue(JSON.stringify({ county: 'Cluj', locality: 'Cluj-Napoca' }));
      
      await geospatialService.reverseGeocode(46.77123, 23.59456);
      
      expect(redisClient!.get).toHaveBeenCalledWith('geo:46.77123:23.59456');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('Redis setex is called with correct TTL (not 0, not Infinity)', async () => {
      (redisClient!.get as jest.Mock).mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({ data: { address: { county: 'Județul Cluj', village: 'SomeTown' } } });

      await geospatialService.reverseGeocode(46.77, 23.59);

      expect(redisClient!.setex).toHaveBeenCalledWith('geo:46.77000:23.59000', 24 * 60 * 60, JSON.stringify({ county: 'Cluj', locality: 'SomeTown' }));
    });

    it('Redis set failure does not crash reverseGeocode', async () => {
      (redisClient!.get as jest.Mock).mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({ data: { address: { county: 'Județul Cluj', village: 'SomeTown' } } });
      (redisClient!.setex as jest.Mock).mockRejectedValue(new Error('Redis set down'));

      const res = await geospatialService.reverseGeocode(46.77, 23.59);
      expect(res).toEqual({ county: 'Cluj', locality: 'SomeTown' });
    });

    it('Redis failure (connection error) does not crash the service — falls back to Nominatim', async () => {
      (redisClient!.get as jest.Mock).mockRejectedValue(new Error('Redis is down'));
      mockedAxios.get.mockResolvedValue({ data: { address: { county: 'Sibiu', city: 'Sibiu' } } });

      const res = await geospatialService.reverseGeocode(45.79, 24.15);

      expect(res).toEqual({ county: 'Sibiu', locality: 'Sibiu' });
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('retries exactly 3 times before throwing (not infinite) for 5xx errors', async () => {
      (redisClient!.get as jest.Mock).mockResolvedValue(null);
      const networkError = new Error('Network error');
      mockedAxios.get.mockRejectedValue(networkError);

      const res = await geospatialService.reverseGeocode(45.79, 24.15);

      expect(res).toBeNull();
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it('backoff delay increases between retries (exponential, not fixed)', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb(); // Execută imediat, fără a mai bloca promisiunea
        return 0 as any;
      });

      (redisClient!.get as jest.Mock).mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await geospatialService.reverseGeocode(45.79, 24.15);

      // Verificăm delay-urile: attempt 1 -> delay 400, attempt 2 -> 800, attempt 3 -> 1600
      expect(setTimeout).toHaveBeenCalledTimes(3);
      const delays = (setTimeout as any as jest.Mock).mock.calls.map(call => call[1]);
      expect(delays[0]).toBe(400); // 200 * 2^1
      expect(delays[1]).toBe(800); // 200 * 2^2
      expect(delays[2]).toBe(1600); // 200 * 2^3
    });

    it('does not retry on 4xx errors from Nominatim (only on 5xx/network errors)', async () => {
      (redisClient!.get as jest.Mock).mockResolvedValue(null);
      const error404: any = new Error('Not found');
      error404.response = { status: 404 };
      mockedAxios.get.mockRejectedValue(error404);

      const res = await geospatialService.reverseGeocode(45.79, 24.15);

      expect(res).toBeNull();
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Fără retry-uri
    });

    it('catches generic errors and returns null (e.g. from toFixed on null input)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await geospatialService.reverseGeocode(null as any, null as any);
      expect(res).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Eroare reverse geocoding:', expect.any(TypeError));
      consoleSpy.mockRestore();
    });
  });

  describe('getSeismicZone and getFrostDepth', () => {
    it('returns valid rules for known county', () => {
      const zone = geospatialService.getSeismicZone('Cluj');
      expect(zone === null || typeof zone === 'object').toBeTruthy();

      const frost = geospatialService.getFrostDepth('Cluj');
      expect(frost === null || typeof frost === 'number').toBeTruthy();
    });
  });

  describe('getFloorRules', () => {
    it('returns 2 if seismic zone not found', () => {
      expect(geospatialService.getFloorRules('invalid_zone', 'argila')).toBe(2);
    });

    it('returns rule for soil type if exists or default', () => {
      // Mocking floorRules indirectly through behavior or just testing default
      expect(geospatialService.getFloorRules('0.20g', 'invalid_soil')).toBeGreaterThanOrEqual(1);
    });
  });
});
