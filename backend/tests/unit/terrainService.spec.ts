import { terrainService } from '../../../src/modules/terrain/terrainService';
import { geospatialService } from '../../../src/modules/terrain/geospatialService';

jest.mock('../../../src/modules/terrain/geospatialService');
const mockedGeo = geospatialService as jest.Mocked<typeof geospatialService>;

describe('terrainService.analyzeLocation', () => {
  beforeEach(() => jest.resetAllMocks());

  it('throws when county cannot be determined', async () => {
    mockedGeo.reverseGeocode.mockResolvedValue(null);
    await expect(terrainService.analyzeLocation({ lat: 0, lng: 0 })).rejects.toThrow('Unable to determine county');
  });

  it('returns data when coordinates present and resolved', async () => {
    mockedGeo.reverseGeocode.mockResolvedValue({ county: 'Cluj', locality: 'Local' });
    mockedGeo.getSeismicZone.mockReturnValue({ ag: '0.25g' } as any);
    mockedGeo.getFrostDepth.mockReturnValue(100 as any);

    const res = await terrainService.analyzeLocation({ lat: 46.77, lng: 23.59 });
    expect(res.county.toLowerCase()).toContain('cluj');
    expect(res.locality).toBe('Local');
    expect(res.seismicZone).toBe('0.25g');
    expect(res.frostDepthCm).toBe(100);
  });

  it('uses provided county if coords absent', async () => {
    mockedGeo.getSeismicZone.mockReturnValue({ ag: '0.20g' } as any);
    mockedGeo.getFrostDepth.mockReturnValue(80 as any);

    const res = await terrainService.analyzeLocation({ county: 'Bucuresti' });
    expect(res.county.toLowerCase()).toContain('bucuresti');
    expect(res.seismicZone).toBe('0.20g');
    expect(res.frostDepthCm).toBe(80);
  });
});
