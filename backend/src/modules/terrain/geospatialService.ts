import axios from 'axios';
import fs from 'fs';
import path from 'path';

const seismicZones = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/seismic-zones.json'), 'utf-8'));
const frostDepth = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/frost-depth.json'), 'utf-8'));
const floorRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/floor-rules.json'), 'utf-8'));

export const geospatialService = {
  // Free reverse geocoding with Nominatim OSM
  async reverseGeocode(lat: number, lng: number): Promise<{ county: string, locality: string } | null> {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ro`,
        { headers: { 'User-Agent': 'BuildWise/1.0' } }
      );

      const addr = response.data.address;
      // Depending on nominatim format, county might be under .county or .state if not mapped perfectly.
      // Usually it's returned as "Județul Cluj" -> we can normalize it
      let county = addr.county || addr.state || addr.region || addr.city || addr.municipality || addr.town || '';
      county = county.replace(/Județul /g, '').replace(' County', '').trim();

      const locality = addr.village || addr.town || addr.city || addr.municipality || '';

      return { county, locality };
    } catch (error) {
      console.error('Eroare reverse geocoding Nominatim:', error);
      return null;
    }
  },

  getSeismicZone(county: string) {
    // Normalizare simplă pt matching (fără diacritice)
    const normalizedCounty = this.normalizeString(county);
    const keys = Object.keys(seismicZones);
    const matchedKey = keys.find(k => this.normalizeString(k) === normalizedCounty);
    return matchedKey ? seismicZones[matchedKey] : null;
  },

  getFrostDepth(county: string): number | null {
    const normalizedCounty = this.normalizeString(county);
    const keys = Object.keys(frostDepth);
    const matchedKey = keys.find(k => this.normalizeString(k) === normalizedCounty);
    return matchedKey ? frostDepth[matchedKey] : null;
  },

  getFloorRules(seismicZone: string, soilType: string): number {
    const rules = floorRules[seismicZone];
    if (!rules) return 2; // Default fallback
    return rules[soilType] || rules["default"] || 2;
  },

  normalizeString(str: string) {
    return str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, '');
  }
};
