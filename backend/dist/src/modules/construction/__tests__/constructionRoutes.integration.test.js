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
const constructionRoutes_1 = __importDefault(require("../constructionRoutes"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
jest.mock('jsonwebtoken');
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/api/construction', constructionRoutes_1.default);
describe('Construction Routes (Integration)', () => {
    const validSecret = process.env.JWT_ACCESS_SECRET;
    let tokenUser1;
    let tokenUser2;
    beforeAll(() => {
        tokenUser1 = 'valid-token-1';
        tokenUser2 = 'valid-token-2';
    });
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup valid JWT decoding
        jsonwebtoken_1.default.verify.mockImplementation((token) => {
            if (token === tokenUser1)
                return { id: 1 };
            if (token === tokenUser2)
                return { id: 2 };
            throw new Error('invalid token');
        });
        // Default setup for project 1 owned by user 1
        setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 1, publishedSnapshotId: 10 });
        setup_1.prismaMock.user.findUnique.mockResolvedValue({ id: 1, role: 'CLIENT' });
    });
    describe('Security & TenantGuard', () => {
        it('GET /:projectId without token returns 401', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).get('/api/construction/1');
            expect(res.status).toBe(401);
        }));
        it('GET /:projectId by non-owner returns 403', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.user.findUnique.mockResolvedValue({ id: 2, role: 'CLIENT' });
            const res = yield (0, supertest_1.default)(app)
                .get('/api/construction/1')
                .set('Authorization', `Bearer ${tokenUser2}`);
            expect(res.status).toBe(403);
        }));
        it('PATCH /:projectId/phase/:phaseOrder/complete by non-owner returns 403', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.user.findUnique.mockResolvedValue({ id: 2, role: 'CLIENT' });
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/construction/1/phase/1/complete')
                .set('Authorization', `Bearer ${tokenUser2}`);
            expect(res.status).toBe(403);
        }));
    });
    describe('Input Validation', () => {
        it('PATCH with invalid types returns 400', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/construction/abc/phase/def/complete')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('ID proiect invalid sau lipsă.');
        }));
        it('PATCH with phaseOrder=0 returns 400', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/construction/1/phase/0/complete')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Parametri invalizi');
        }));
        it('PATCH with phaseOrder=-1 returns 400', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/construction/1/phase/-1/complete')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Parametri invalizi');
        }));
    });
    describe('Business Logic Errors', () => {
        const mockPhases = [
            { id: 10, phaseOrder: 1, isCompleted: true },
            { id: 11, phaseOrder: 2, isCompleted: false }
        ];
        it('PATCH on nonexistent phaseOrder (e.g. 99) returns 404', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.constructionPhase.findMany.mockResolvedValue(mockPhases);
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/construction/1/phase/99/complete')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Faza nu exista');
        }));
        it('PATCH on phase with uncompleted prerequisite returns 409', () => __awaiter(void 0, void 0, void 0, function* () {
            // Trying to complete phase 3 when phase 2 is uncompleted
            const phases = [...mockPhases, { id: 12, phaseOrder: 3, isCompleted: false }];
            setup_1.prismaMock.constructionPhase.findMany.mockResolvedValue(phases);
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/construction/1/phase/3/complete')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Faza anterioara nu este completata');
        }));
        it('GET when project has no published PlanSnapshot returns 400', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock db returns no phases
            setup_1.prismaMock.constructionPhase.findMany.mockResolvedValue([]);
            // Mock project repository (which will be used by generatePhasesForProject and tenantGuard)
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 1, publishedSnapshotId: null });
            const res = yield (0, supertest_1.default)(app)
                .get('/api/construction/1')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Proiectul nu are un plan publicat');
        }));
    });
    describe('Happy Paths', () => {
        const mockPhases = [
            { id: 10, phaseOrder: 1, isCompleted: true },
            { id: 11, phaseOrder: 2, isCompleted: false }
        ];
        it('PATCH complete returns updated phase object', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.constructionPhase.findMany.mockResolvedValue(mockPhases);
            const updatedPhase = { id: 11, phaseOrder: 2, isCompleted: true };
            setup_1.prismaMock.constructionPhase.update.mockResolvedValue(updatedPhase);
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/construction/1/phase/2/complete')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.status).toBe(200);
            expect(res.body).toEqual(updatedPhase); // Important for frontend UI updates
        }));
        it('GET returns phases array', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.constructionPhase.findMany.mockResolvedValue(mockPhases);
            const res = yield (0, supertest_1.default)(app)
                .get('/api/construction/1')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockPhases);
        }));
    });
});
