"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geospatialService = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const redis_1 = require("../../lib/redis");
const seismicZones = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../../data/seismic-zones.json'), 'utf-8'));
const frostDepth = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../../data/frost-depth.json'), 'utf-8'));
const floorRules = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../../data/floor-rules.json'), 'utf-8'));
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h
exports.geospatialService = {
    // Free reverse geocoding with Nominatim OSM
    reverseGeocode(lat, lng, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const key = `geo:${lat.toFixed(5)}:${lng.toFixed(5)}`;
                if (redis_1.redisClient) {
                    try {
                        const cached = yield redis_1.redisClient.get(key);
                        if (cached)
                            return JSON.parse(cached);
                    }
                    catch (err) {
                        console.warn('[Redis] failed to read cache for', key, err);
                    }
                }
                // Simple retry/backoff
                const maxAttempts = 3;
                let attempt = 0;
                let lastErr = null;
                while (attempt < maxAttempts) {
                    try {
                        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ro${(opts === null || opts === void 0 ? void 0 : opts.email) ? `&email=${encodeURIComponent(opts.email)}` : ''}`;
                        const response = yield axios_1.default.get(url, { headers: { 'User-Agent': 'BuildWise/1.0 (+https://example.com)' } });
                        const addr = response.data.address || {};
                        let county = addr.county || addr.state || addr.region || addr.city || addr.municipality || addr.town || '';
                        county = county.replace(/Județul /g, '').replace(' County', '').trim();
                        const locality = addr.village || addr.town || addr.city || addr.municipality || '';
                        const result = { county, locality };
                        if (redis_1.redisClient) {
                            try {
                                yield redis_1.redisClient.setex(key, DEFAULT_TTL_SECONDS, JSON.stringify(result));
                            }
                            catch (err) {
                                console.warn('[Redis] failed to set cache for', key, err);
                            }
                        }
                        return result;
                    }
                    catch (err) {
                        lastErr = err;
                        if (err.response && err.response.status >= 400 && err.response.status < 500) {
                            console.error('Nominatim 4xx error, not retrying:', err.response.status);
                            break;
                        }
                        attempt += 1;
                        const delay = 200 * Math.pow(2, attempt);
                        yield new Promise(r => setTimeout(r, delay));
                    }
                }
                console.error('Eroare reverse geocoding Nominatim after retries:', lastErr);
                return null;
            }
            catch (error) {
                console.error('Eroare reverse geocoding:', error);
                return null;
            }
        });
    },
    getSeismicZone(county) {
        const normalizedCounty = this.normalizeString(county);
        const keys = Object.keys(seismicZones);
        const matchedKey = keys.find(k => this.normalizeString(k) === normalizedCounty);
        return matchedKey ? seismicZones[matchedKey] : null;
    },
    getFrostDepth(county) {
        const normalizedCounty = this.normalizeString(county);
        const keys = Object.keys(frostDepth);
        const matchedKey = keys.find(k => this.normalizeString(k) === normalizedCounty);
        return matchedKey ? frostDepth[matchedKey] : null;
    },
    getFloorRules(seismicZone, soilType) {
        const rules = floorRules[seismicZone];
        if (!rules)
            return 2; // Default fallback
        return rules[soilType] || rules["default"] || 2;
    },
    normalizeString(str) {
        return (str || '').toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, '');
    }
};
