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
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const terrainRoutes_1 = __importDefault(require("../terrainRoutes"));
const redis_1 = require("../../../lib/redis");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mocam serviciul geospatial ca sa nu faca call-uri HTTP la API-uri externe in timpul testelor
jest.mock('../geospatialService', () => ({
    geospatialService: {
        reverseGeocode: jest.fn().mockResolvedValue({ county: 'Bucuresti', locality: 'Sector 1' }),
        getSeismicZone: jest.fn().mockReturnValue({ ag: '0.30g', Tc: '1.6s' }),
        getFrostDepth: jest.fn().mockReturnValue(90)
    }
}));
app.use('/api/terrain', terrainRoutes_1.default);
describe('Terrain & Geospatial API (Integration)', () => {
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Dacă am importat redisClient în teste (chiar dacă nu îl folosim activ aici), 
        // e o bună practică să închidem conexiunea ca să evităm "open handles".
        if (redis_1.redisClient) {
            yield redis_1.redisClient.quit();
        }
    }));
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('screen1Schema Validation', () => {
        it('returns 400 when body is completely empty', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/terrain/analyze-location').send({});
            expect(res.status).toBe(400);
            expect(res.body.status).toBe('error');
        }));
        it('returns 400 when lat is provided without lng', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/terrain/analyze-location').send({ projectId: 1, lat: 44.4 });
            expect(res.status).toBe(400);
            expect(res.body.errors[0].message).toContain('Latitudinea și longitudinea trebuie');
        }));
        it('returns 400 when lng is provided without lat', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/terrain/analyze-location').send({ projectId: 1, lng: 26.1 });
            expect(res.status).toBe(400);
            expect(res.body.errors[0].message).toContain('Latitudinea și longitudinea trebuie');
        }));
        it('returns 200 when only county is provided (no coordinates)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/terrain/analyze-location').send({ projectId: 1, county: 'Cluj' });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.county).toBe('Cluj');
        }));
        it('returns 200 when only lat+lng are provided (no county)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/terrain/analyze-location').send({ projectId: 1, lat: 44.4, lng: 26.1 });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.county).toBe('Bucuresti'); // Din mock-ul reverseGeocode
        }));
    });
    it('POST /api/terrain/analyze-location - success flow with all valid data', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app)
            .post('/api/terrain/analyze-location')
            .send({
            projectId: 1,
            lat: 44.4268,
            lng: 26.1025,
            polygon: []
        });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.county).toBe('Bucuresti');
        expect(res.body.data.seismicZone).toBe('0.30g');
        expect(res.body.data.frostDepthCm).toBe(90);
    }));
});
