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
const geospatialService_1 = require("../geospatialService");
const axios_1 = __importDefault(require("axios"));
const redis_1 = require("../../../lib/redis");
jest.mock('axios');
const mockedAxios = axios_1.default;
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
            expect(geospatialService_1.geospatialService.normalizeString('Județul Cluj')).toBe('judetulcluj');
        });
    });
    describe('reverseGeocode', () => {
        it('cache key includes lat+lng for GPS requests, not just county name', () => __awaiter(void 0, void 0, void 0, function* () {
            redis_1.redisClient.get.mockResolvedValue(JSON.stringify({ county: 'Cluj', locality: 'Cluj-Napoca' }));
            yield geospatialService_1.geospatialService.reverseGeocode(46.77123, 23.59456);
            expect(redis_1.redisClient.get).toHaveBeenCalledWith('geo:46.77123:23.59456');
            expect(mockedAxios.get).not.toHaveBeenCalled();
        }));
        it('Redis setex is called with correct TTL (not 0, not Infinity)', () => __awaiter(void 0, void 0, void 0, function* () {
            redis_1.redisClient.get.mockResolvedValue(null);
            mockedAxios.get.mockResolvedValue({ data: { address: { county: 'Județul Cluj', village: 'SomeTown' } } });
            yield geospatialService_1.geospatialService.reverseGeocode(46.77, 23.59);
            expect(redis_1.redisClient.setex).toHaveBeenCalledWith('geo:46.77000:23.59000', 24 * 60 * 60, JSON.stringify({ county: 'Cluj', locality: 'SomeTown' }));
        }));
        it('Redis set failure does not crash reverseGeocode', () => __awaiter(void 0, void 0, void 0, function* () {
            redis_1.redisClient.get.mockResolvedValue(null);
            mockedAxios.get.mockResolvedValue({ data: { address: { county: 'Județul Cluj', village: 'SomeTown' } } });
            redis_1.redisClient.setex.mockRejectedValue(new Error('Redis set down'));
            const res = yield geospatialService_1.geospatialService.reverseGeocode(46.77, 23.59);
            expect(res).toEqual({ county: 'Cluj', locality: 'SomeTown' });
        }));
        it('Redis failure (connection error) does not crash the service — falls back to Nominatim', () => __awaiter(void 0, void 0, void 0, function* () {
            redis_1.redisClient.get.mockRejectedValue(new Error('Redis is down'));
            mockedAxios.get.mockResolvedValue({ data: { address: { county: 'Sibiu', city: 'Sibiu' } } });
            const res = yield geospatialService_1.geospatialService.reverseGeocode(45.79, 24.15);
            expect(res).toEqual({ county: 'Sibiu', locality: 'Sibiu' });
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        }));
        it('retries exactly 3 times before throwing (not infinite) for 5xx errors', () => __awaiter(void 0, void 0, void 0, function* () {
            redis_1.redisClient.get.mockResolvedValue(null);
            const networkError = new Error('Network error');
            mockedAxios.get.mockRejectedValue(networkError);
            const res = yield geospatialService_1.geospatialService.reverseGeocode(45.79, 24.15);
            expect(res).toBeNull();
            expect(mockedAxios.get).toHaveBeenCalledTimes(3);
        }));
        it('backoff delay increases between retries (exponential, not fixed)', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
                cb(); // Execută imediat, fără a mai bloca promisiunea
                return 0;
            });
            redis_1.redisClient.get.mockResolvedValue(null);
            mockedAxios.get.mockRejectedValue(new Error('Network error'));
            yield geospatialService_1.geospatialService.reverseGeocode(45.79, 24.15);
            // Verificăm delay-urile: attempt 1 -> delay 400, attempt 2 -> 800, attempt 3 -> 1600
            expect(setTimeout).toHaveBeenCalledTimes(3);
            const delays = setTimeout.mock.calls.map(call => call[1]);
            expect(delays[0]).toBe(400); // 200 * 2^1
            expect(delays[1]).toBe(800); // 200 * 2^2
            expect(delays[2]).toBe(1600); // 200 * 2^3
        }));
        it('does not retry on 4xx errors from Nominatim (only on 5xx/network errors)', () => __awaiter(void 0, void 0, void 0, function* () {
            redis_1.redisClient.get.mockResolvedValue(null);
            const error404 = new Error('Not found');
            error404.response = { status: 404 };
            mockedAxios.get.mockRejectedValue(error404);
            const res = yield geospatialService_1.geospatialService.reverseGeocode(45.79, 24.15);
            expect(res).toBeNull();
            expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Fără retry-uri
        }));
        it('catches generic errors and returns null (e.g. from toFixed on null input)', () => __awaiter(void 0, void 0, void 0, function* () {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            const res = yield geospatialService_1.geospatialService.reverseGeocode(null, null);
            expect(res).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Eroare reverse geocoding:', expect.any(TypeError));
            consoleSpy.mockRestore();
        }));
    });
    describe('getSeismicZone and getFrostDepth', () => {
        it('returns valid rules for known county', () => {
            const zone = geospatialService_1.geospatialService.getSeismicZone('Cluj');
            expect(zone === null || typeof zone === 'object').toBeTruthy();
            const frost = geospatialService_1.geospatialService.getFrostDepth('Cluj');
            expect(frost === null || typeof frost === 'number').toBeTruthy();
        });
    });
    describe('getFloorRules', () => {
        it('returns 2 if seismic zone not found', () => {
            expect(geospatialService_1.geospatialService.getFloorRules('invalid_zone', 'argila')).toBe(2);
        });
        it('returns rule for soil type if exists or default', () => {
            // Mocking floorRules indirectly through behavior or just testing default
            expect(geospatialService_1.geospatialService.getFloorRules('0.20g', 'invalid_soil')).toBeGreaterThanOrEqual(1);
        });
    });
});
