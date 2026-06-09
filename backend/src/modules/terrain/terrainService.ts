import { geospatialService } from './geospatialService';
import { terrainRepository } from './terrainRepository';

export const terrainService = {
  async analyzeLocation(input: { lat?: number | null, lng?: number | null, county?: string | null }) {
    const { lat, lng } = input;
    let county = input.county || '';
    let locality = '';

    if (lat != null && lng != null) {
      if (lat === 0 && lng === 0) {
        throw new Error('Unable to determine county from coordinates: 0,0 (Null Island) is invalid.');
      }
      const geoData = await geospatialService.reverseGeocode(Number(lat), Number(lng));
      if (geoData) {
        county = county || geoData.county;
        locality = geoData.locality;
      }
    }

    if (!county) {
      throw new Error('Unable to determine county from coordinates or input.');
    }

    const seismic = geospatialService.getSeismicZone(county);
    const frost = geospatialService.getFrostDepth(county);

    return {
      county,
      locality,
      seismicZone: seismic?.ag || '0.20g',
      frostDepthCm: frost || 90
    };
  }
};
