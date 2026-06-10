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
Object.defineProperty(exports, "__esModule", { value: true });
const terrainService_1 = require("../terrainService");
const geospatialService_1 = require("../geospatialService");
jest.mock('../geospatialService');
describe('terrainService (unit)', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });
    describe('analyzeLocation', () => {
        it('returns seismicZone "0.20g" as fallback for unknown county', () => __awaiter(void 0, void 0, void 0, function* () {
            geospatialService_1.geospatialService.getSeismicZone.mockReturnValue(null);
            geospatialService_1.geospatialService.getFrostDepth.mockReturnValue(null);
            const result = yield terrainService_1.terrainService.analyzeLocation({ county: 'UnknownCounty' });
            expect(result.seismicZone).toBe('0.20g');
        }));
        it('returns frostDepthCm 90 as fallback for unknown county', () => __awaiter(void 0, void 0, void 0, function* () {
            geospatialService_1.geospatialService.getSeismicZone.mockReturnValue(null);
            geospatialService_1.geospatialService.getFrostDepth.mockReturnValue(null);
            const result = yield terrainService_1.terrainService.analyzeLocation({ county: 'UnknownCounty' });
            expect(result.frostDepthCm).toBe(90);
        }));
        it('fallback values are within valid range (seismic: one of known zones, frost: >0)', () => __awaiter(void 0, void 0, void 0, function* () {
            geospatialService_1.geospatialService.getSeismicZone.mockReturnValue(null);
            geospatialService_1.geospatialService.getFrostDepth.mockReturnValue(null);
            const result = yield terrainService_1.terrainService.analyzeLocation({ county: 'UnknownCounty' });
            // Verificăm dacă seismic fallback e unul valid tipic (0.10g, 0.15g, 0.20g, 0.25g, 0.30g, 0.35g, 0.40g)
            expect(['0.10g', '0.15g', '0.20g', '0.25g', '0.30g', '0.35g', '0.40g']).toContain(result.seismicZone);
            expect(result.frostDepthCm).toBeGreaterThan(0);
        }));
        it('throws "Unable to determine county" when lat=0 and lng=0 (null island)', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(terrainService_1.terrainService.analyzeLocation({ lat: 0, lng: 0 })).rejects.toThrow('Unable to determine county from coordinates: 0,0 (Null Island) is invalid.');
        }));
        it('throws when lat/lng are valid numbers but Nominatim returns no Romanian county', () => __awaiter(void 0, void 0, void 0, function* () {
            geospatialService_1.geospatialService.reverseGeocode.mockResolvedValue(null);
            yield expect(terrainService_1.terrainService.analyzeLocation({ lat: 46.0, lng: 24.0 })).rejects.toThrow('Unable to determine county from coordinates or input.');
        }));
        it('prefers explicit county param over reverseGeocode even when lat/lng are present', () => __awaiter(void 0, void 0, void 0, function* () {
            geospatialService_1.geospatialService.reverseGeocode.mockResolvedValue({ county: 'Cluj', locality: 'Cluj-Napoca' });
            geospatialService_1.geospatialService.getSeismicZone.mockReturnValue({ ag: '0.25g' });
            geospatialService_1.geospatialService.getFrostDepth.mockReturnValue(100);
            const result = yield terrainService_1.terrainService.analyzeLocation({ lat: 46.0, lng: 24.0, county: 'Bucuresti' });
            // Locality vine de la GPS (Cluj-Napoca), dar county rămâne cel explicit (Bucuresti)
            expect(result.county).toBe('Bucuresti');
            expect(result.locality).toBe('Cluj-Napoca');
            expect(geospatialService_1.geospatialService.getSeismicZone).toHaveBeenCalledWith('Bucuresti');
        }));
    });
});
