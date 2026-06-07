import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { redisClient } from '../../lib/redis';

const seismicZones = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/seismic-zones.json'), 'utf-8'));
const frostDepth = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/frost-depth.json'), 'utf-8'));
const floorRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/floor-rules.json'), 'utf-8'));

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h

export const geospatialService = {
  // Free reverse geocoding with Nominatim OSM
  async reverseGeocode(lat: number, lng: number, opts?: { email?: string }): Promise<{ county: string, locality: string } | null> {
    try {
      const key = `geo:${lat.toFixed(5)}:${lng.toFixed(5)}`;

      if (redisClient) {
        try {
          const cached = await redisClient.get(key);
          if (cached) return JSON.parse(cached);
        } catch (err) {
          console.warn('[Redis] failed to read cache for', key, err);
        }
      }

      // Simple retry/backoff
      const maxAttempts = 3;
      let attempt = 0;
      let lastErr: any = null;

      while (attempt < maxAttempts) {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ro${opts?.email ? `&email=${encodeURIComponent(opts.email)}` : ''}`;
          const response = await axios.get(url, { headers: { 'User-Agent': 'BuildWise/1.0 (+https://example.com)' } });

          const addr = response.data.address || {};
          let county = addr.county || addr.state || addr.region || addr.city || addr.municipality || addr.town || '';
          county = county.replace(/Județul /g, '').replace(' County', '').trim();
          const locality = addr.village || addr.town || addr.city || addr.municipality || '';

          const result = { county, locality };

          if (redisClient) {
            try {
              await redisClient.setex(key, DEFAULT_TTL_SECONDS, JSON.stringify(result));
            } catch (err) {
              console.warn('[Redis] failed to set cache for', key, err);
            }
          }

          return result;
        } catch (err: any) {
          lastErr = err;
          if (err.response && err.response.status >= 400 && err.response.status < 500) {
            console.error('Nominatim 4xx error, not retrying:', err.response.status);
            break;
          }
          attempt += 1;
          const delay = 200 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      console.error('Eroare reverse geocoding Nominatim after retries:', lastErr);
      return null;
    } catch (error) {
      console.error('Eroare reverse geocoding:', error);
      return null;
    }
  },

  getSeismicZone(county: string) {
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
    return (str || '').toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '');
  }
};
