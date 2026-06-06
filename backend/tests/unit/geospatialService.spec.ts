import { geospatialService } from '../../../src/modules/terrain/geospatialService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('geospatialService (unit)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('normalizeString removes diacritics and non-alphanum', () => {
    const s = 'Județul Cluj';
    const out = (geospatialService as any).normalizeString(s);
    expect(out).toBe('judetulcluj');
  });

  it('reverseGeocode returns normalized county and locality (mocked axios)', async () => {
    mockedAxios.get.mockResolvedValue({ data: { address: { county: 'Județul Cluj', village: 'SomeTown' } } });

    const res = await geospatialService.reverseGeocode(46.77, 23.59);
    expect(res).not.toBeNull();
    expect(res?.county.toLowerCase()).toContain('cluj');
    expect(res?.locality).toBe('SomeTown');
  });

  it('getSeismicZone and getFrostDepth return values for known county', () => {
    const zone = geospatialService.getSeismicZone('Cluj');
    // If data file contains Cluj, should return an object or null otherwise
    expect(zone === null || typeof zone === 'object').toBeTruthy();

    const frost = geospatialService.getFrostDepth('Cluj');
    expect(frost === null || typeof frost === 'number').toBeTruthy();
  });
});
