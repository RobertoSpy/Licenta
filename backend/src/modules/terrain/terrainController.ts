import { Request, Response } from 'express';
import { geospatialService } from './geospatialService';

export const analyzeLocation = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    let county = req.body.county;
    let locality = '';

    if (lat && lng) {
      const geoData = await geospatialService.reverseGeocode(lat, lng);
      if (geoData) {
        county = county || geoData.county;
        locality = geoData.locality;
      }
    }

    if (!county) {
      return res.status(400).json({ status: 'error', message: 'Unable to determine county from coordinates or input.' });
    }

    const seismicZone = geospatialService.getSeismicZone(county);
    const frostDepthCm = geospatialService.getFrostDepth(county);

    return res.status(200).json({
      status: 'success',
      data: {
        county,
        locality,
        seismicZone: seismicZone?.ag || '0.20g', // default fallback
        frostDepthCm: frostDepthCm || 90 // default fallback
      }
    });

  } catch (error: any) {
    console.error('Error analyzing location:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};
