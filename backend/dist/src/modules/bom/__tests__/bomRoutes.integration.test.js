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
const bomRoutes_1 = __importDefault(require("../bomRoutes"));
const bomService_1 = require("../bomService");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mockăm autentificarea (protect) și autorizarea (tenantGuard)
// Notă: Securitatea reală a middleware-urilor este testată în detaliu în authRoutes/tenantGuard unit tests.
// Aici doar ne asigurăm că rutele noastre BOM le aplică corect (Wired up correctly).
jest.mock('../../../core/middleware/authMiddleware', () => ({
    protect: (req, res, next) => {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }
        req.user = { id: parseInt(req.headers['x-user-id'] || '1', 10), role: 'CLIENT' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
}));
jest.mock('../../../core/middleware/tenantGuard', () => ({
    tenantGuard: (req, res, next) => {
        const projectId = parseInt(req.params.projectId, 10);
        // Logica simplificată de ownership mock: User N owns Project N.
        if (req.user.id !== projectId) {
            return res.status(403).json({ message: 'Forbidden: You do not own this project' });
        }
        next();
    }
}));
// Mockăm logica bomService pentru a testa doar controllerul
jest.mock('../bomService', () => ({
    bomService: {
        calculateBOM: jest.fn(),
        updateMaterialOverride: jest.fn(),
    }
}));
app.use('/api/bom', bomRoutes_1.default);
describe('BOM Module API (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('Securitate & Autentificare (Wired Up)', () => {
        it('ar trebui sa returneze 401 daca lipseste tokenul de autentificare', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/bom/1/generate');
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Not authorized, no token');
        }));
        it('ar trebui sa returneze 403 daca utilizatorul acceseaza devizul altui proiect (Ownership)', () => __awaiter(void 0, void 0, void 0, function* () {
            // Userul 2 incearca sa acceseze proiectul 1
            const res = yield (0, supertest_1.default)(app)
                .post('/api/bom/1/generate')
                .set('Authorization', 'Bearer MOCK_TOKEN')
                .set('x-user-id', '2');
            expect(res.status).toBe(403);
            expect(res.body.message).toBe('Forbidden: You do not own this project');
        }));
    });
    describe('Rute Valide', () => {
        it('POST /api/bom/:projectId/generate - Ar trebui sa genereze BOM-ul', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockBomItems = [{ id: 1, materialId: 10, phase: 'fundatie', quantity: 5 }];
            bomService_1.bomService.calculateBOM.mockResolvedValue(mockBomItems);
            const res = yield (0, supertest_1.default)(app)
                .post('/api/bom/1/generate')
                .set('Authorization', 'Bearer MOCK_TOKEN')
                .set('x-user-id', '1');
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockBomItems);
            expect(bomService_1.bomService.calculateBOM).toHaveBeenCalledWith(1);
        }));
        it('PATCH /api/bom/:projectId/material - Ar trebui sa suprascrie un material', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockBomItems = [{ id: 1, formulaKey: 'beton_fundatie', materialId: 20 }];
            bomService_1.bomService.updateMaterialOverride.mockResolvedValue(mockBomItems);
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/bom/1/material')
                .set('Authorization', 'Bearer MOCK_TOKEN')
                .set('x-user-id', '1')
                .send({
                formulaKey: 'beton_fundatie',
                newMaterialCode: 'BET-NOU'
            });
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockBomItems);
            expect(bomService_1.bomService.updateMaterialOverride).toHaveBeenCalledWith(1, 'beton_fundatie', 'BET-NOU');
        }));
        it('PATCH /api/bom/:projectId/material - Ar trebui sa returneze 400 pt input invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/bom/1/material')
                .set('Authorization', 'Bearer MOCK_TOKEN')
                .set('x-user-id', '1')
                .send({ formulaKey: 'beton_fundatie' }); // Lipseste newMaterialCode
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Necesită formulaKey și newMaterialCode');
        }));
    });
});
