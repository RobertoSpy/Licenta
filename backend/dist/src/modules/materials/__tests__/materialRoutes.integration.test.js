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
const materialRoutes_1 = __importDefault(require("../materialRoutes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Bypass la JWT pentru a mentine mediul de test curat si izolat
jest.mock('../../../core/middleware/authMiddleware', () => ({
    protect: (req, res, next) => {
        req.user = { id: 1, role: 'CLIENT' };
        next();
    }
}));
app.use('/api/materials', materialRoutes_1.default);
describe('Material Module API (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('GET /api/materials - Ar trebui sa returneze tot catalogul de materiale', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mocam un rand de baza de date cu un material
        setup_1.prismaMock.material.findMany.mockResolvedValue([
            { id: 1, internalCode: 'BET-C20', name: 'Beton C20/25', category: 'Beton', pricePerUnit: 350 }
        ]);
        const res = yield (0, supertest_1.default)(app).get('/api/materials');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].internalCode).toBe('BET-C20');
    }));
    it('GET /api/materials/:code/alternatives - Ar trebui sa gaseasca alternative conform normativului', () => __awaiter(void 0, void 0, void 0, function* () {
        // Returnam un material premium ca alternativă
        setup_1.prismaMock.material.findUnique.mockResolvedValue({
            id: 2,
            internalCode: 'BET-C20',
            alternatives: [
                { id: 3, internalCode: 'BET-C25', name: 'Beton C25/30', budgetCategory: 'premium', pricePerUnit: 400 }
            ]
        });
        const res = yield (0, supertest_1.default)(app).get('/api/materials/BET-C20/alternatives');
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].budgetCategory).toBe('premium');
    }));
});
