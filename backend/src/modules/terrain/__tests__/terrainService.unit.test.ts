import { terrainService } from '../terrainService';
import { geospatialService } from '../geospatialService';

jest.mock('../geospatialService');

describe('terrainService (unit)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('analyzeLocation', () => {
    it('returns seismicZone "0.20g" as fallback for unknown county', async () => {
      (geospatialService.getSeismicZone as jest.Mock).mockReturnValue(null);
      (geospatialService.getFrostDepth as jest.Mock).mockReturnValue(null);

      const result = await terrainService.analyzeLocation({ county: 'UnknownCounty' });

      expect(result.seismicZone).toBe('0.20g');
    });

    it('returns frostDepthCm 90 as fallback for unknown county', async () => {
      (geospatialService.getSeismicZone as jest.Mock).mockReturnValue(null);
      (geospatialService.getFrostDepth as jest.Mock).mockReturnValue(null);

      const result = await terrainService.analyzeLocation({ county: 'UnknownCounty' });

      expect(result.frostDepthCm).toBe(90);
    });

    it('fallback values are within valid range (seismic: one of known zones, frost: >0)', async () => {
      (geospatialService.getSeismicZone as jest.Mock).mockReturnValue(null);
      (geospatialService.getFrostDepth as jest.Mock).mockReturnValue(null);

      const result = await terrainService.analyzeLocation({ county: 'UnknownCounty' });

      // Verificăm dacă seismic fallback e unul valid tipic (0.10g, 0.15g, 0.20g, 0.25g, 0.30g, 0.35g, 0.40g)
      expect(['0.10g', '0.15g', '0.20g', '0.25g', '0.30g', '0.35g', '0.40g']).toContain(result.seismicZone);
      expect(result.frostDepthCm).toBeGreaterThan(0);
    });

    it('throws "Unable to determine county" when lat=0 and lng=0 (null island)', async () => {
      await expect(
        terrainService.analyzeLocation({ lat: 0, lng: 0 })
      ).rejects.toThrow('Unable to determine county from coordinates: 0,0 (Null Island) is invalid.');
    });

    it('throws when lat/lng are valid numbers but Nominatim returns no Romanian county', async () => {
      (geospatialService.reverseGeocode as jest.Mock).mockResolvedValue(null);

      await expect(
        terrainService.analyzeLocation({ lat: 46.0, lng: 24.0 })
      ).rejects.toThrow('Unable to determine county from coordinates or input.');
    });

    it('prefers explicit county param over reverseGeocode even when lat/lng are present', async () => {
      (geospatialService.reverseGeocode as jest.Mock).mockResolvedValue({ county: 'Cluj', locality: 'Cluj-Napoca' });
      (geospatialService.getSeismicZone as jest.Mock).mockReturnValue({ ag: '0.25g' });
      (geospatialService.getFrostDepth as jest.Mock).mockReturnValue(100);

      const result = await terrainService.analyzeLocation({ lat: 46.0, lng: 24.0, county: 'Bucuresti' });

      // Locality vine de la GPS (Cluj-Napoca), dar county rămâne cel explicit (Bucuresti)
      expect(result.county).toBe('Bucuresti');
      expect(result.locality).toBe('Cluj-Napoca');
      expect(geospatialService.getSeismicZone).toHaveBeenCalledWith('Bucuresti');
    });
  });
});
