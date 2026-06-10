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
const setup_1 = require("../../../../tests/setup");
const marketRoutes_1 = __importDefault(require("../marketRoutes"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mock jwt
jest.mock('jsonwebtoken');
app.use('/api/market', marketRoutes_1.default);
describe('Market Routes (Integration)', () => {
    let token;
    beforeAll(() => {
        token = 'valid-token';
    });
    beforeEach(() => {
        jest.clearAllMocks();
        jsonwebtoken_1.default.verify.mockImplementation(() => {
            return { id: 10, role: 'CLIENT' };
        });
        setup_1.prismaMock.user.findUnique.mockImplementation(() => __awaiter(void 0, void 0, void 0, function* () {
            return { id: 10, role: 'CLIENT', status: 'ACTIVE' };
        }));
    });
    it('GET /history returns 401 without token', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).get('/api/market/history');
        expect(res.status).toBe(401);
    }));
    it('GET /forecast returns 422/500 when insufficient data points (< 2)', () => __awaiter(void 0, void 0, void 0, function* () {
        // 0 points returned
        setup_1.prismaMock.marketIndexPoint.findMany.mockResolvedValue([]);
        const res = yield (0, supertest_1.default)(app)
            .get('/api/market/forecast')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
        // Eroarea interna n-ar trebui expusă în obiect dacă n-am implementat middleware explicit
        // Dar măcar mesajul de la Controller e: "Eroare la generarea prognozei."
        expect(res.body.error).toBe('Eroare la generarea prognozei.');
        expect(res.body.message).toBeUndefined(); // internal error string is NOT exposed
    }));
    it('GET /forecast returns 200 with fresh forecast when cache is corrupted', () => __awaiter(void 0, void 0, void 0, function* () {
        // Corrupted cache
        setup_1.prismaMock.marketForecastCache.findFirst.mockResolvedValue({
            generatedAt: new Date().toISOString(), // fresh
            forecastJson: 'not a json'
        });
        // Mock points for regression
        setup_1.prismaMock.marketIndexPoint.findMany.mockResolvedValue([
            { year: 2026, month: 1, indexValue: 100 },
            { year: 2026, month: 2, indexValue: 110 }
        ]);
        // Mock upsert
        setup_1.prismaMock.$transaction.mockResolvedValue({ id: 1 });
        const res = yield (0, supertest_1.default)(app)
            .get('/api/market/forecast')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.years).toBeDefined();
        expect(setup_1.prismaMock.$transaction).toHaveBeenCalled(); // Means upsert was called
    }));
});
