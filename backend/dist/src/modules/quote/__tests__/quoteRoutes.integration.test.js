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
const quoteRoutes_1 = __importDefault(require("../quoteRoutes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mockauth pentru CLIENT by default
app.use('/api/quotes', (req, res, next) => {
    if (!req.user) {
        req.user = { id: 100, role: 'CLIENT' };
    }
    next();
});
jest.mock('../../../core/middleware/authMiddleware', () => ({
    protect: (req, res, next) => next()
}));
jest.mock('../../../core/middleware/roleMiddleware', () => ({
    requireRole: (allowedRoles) => (req, res, next) => {
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        if (roles.includes(req.user.role)) {
            next();
        }
        else {
            res.status(403).json({ message: 'Forbidden' });
        }
    }
}));
app.use('/api/quotes', quoteRoutes_1.default);
// Setup a separate path for CONTRACTOR testing
const contractorApp = (0, express_1.default)();
contractorApp.use(express_1.default.json());
contractorApp.use('/api/quotes', (req, res, next) => {
    req.user = { id: 50, role: 'CONTRACTOR' };
    next();
});
contractorApp.use('/api/quotes', quoteRoutes_1.default);
describe('Quote API Routes (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('RBAC Cross-Role Enforcement', () => {
        it('CLIENT cannot POST /quotes/:id/submit (403)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/quotes/1/submit').send({ totalAmount: 100 });
            expect(res.status).toBe(403);
        }));
        it('CONTRACTOR cannot POST /quotes/:id/accept (403)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(contractorApp).post('/api/quotes/1/accept');
            expect(res.status).toBe(403);
        }));
        it('CONTRACTOR cannot GET /quotes/project/:projectId (403)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(contractorApp).get('/api/quotes/project/1');
            expect(res.status).toBe(403);
        }));
        it('CLIENT cannot GET /quotes/contractor (403)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).get('/api/quotes/contractor');
            expect(res.status).toBe(403);
        }));
        it('CONTRACTOR cannot POST /quotes/request (403)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(contractorApp).post('/api/quotes/request').send({ projectId: 1, contractorIds: [50] });
            expect(res.status).toBe(403);
        }));
    });
    describe('Client Routes', () => {
        it('POST /api/quotes/request - returns 201 when quotes are created', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, constructionPhases: [{ name: 'Fundatie' }] });
            setup_1.prismaMock.contractorProfile.findMany.mockResolvedValue([
                { id: 50, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] },
                { id: 51, specializations: ['STRUCTURA', 'FUNDATII', 'CONSTRUCTII_GENERALE'] }
            ]);
            setup_1.prismaMock.contractorQuote.findMany.mockResolvedValue([]);
            setup_1.prismaMock.contractorQuote.createMany.mockResolvedValue({ count: 2 });
            const response = yield (0, supertest_1.default)(app)
                .post('/api/quotes/request')
                .send({
                projectId: 1,
                contractorIds: [50, 51],
                message: 'Astept ofertele voastre!'
            });
            expect(response.status).toBe(201);
            expect(response.body.message).toBe('Cereri trimise cu succes.');
            expect(response.body.count).toBe(2);
        }));
        it('GET /api/quotes/project/:projectId - returns 200 with quotes', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 100 });
            setup_1.prismaMock.contractorQuote.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            const response = yield (0, supertest_1.default)(app).get('/api/quotes/project/1');
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
        }));
        it('POST /api/quotes/:id/accept - returns 200 on success', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({
                id: 1,
                projectId: 1,
                project: { userId: 100 },
                phases: [{ id: 101 }]
            });
            setup_1.prismaMock.$transaction.mockImplementation((cb) => __awaiter(void 0, void 0, void 0, function* () {
                return { id: 1, status: 'ACCEPTED' };
            }));
            const response = yield (0, supertest_1.default)(app).post('/api/quotes/1/accept');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ACCEPTED');
        }));
    });
    describe('Contractor Routes', () => {
        it('GET /api/quotes/contractor - returns 200 with quotes', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 10, userId: 50 });
            setup_1.prismaMock.contractorQuote.findMany.mockResolvedValue([{ id: 1, contractorId: 10 }]);
            const response = yield (0, supertest_1.default)(contractorApp).get('/api/quotes/contractor');
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
        }));
        it('POST /api/quotes/:id/submit - returns 200 on success', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 10, userId: 50 });
            setup_1.prismaMock.contractorQuote.findUnique.mockResolvedValue({ id: 1, contractorId: 10, status: 'PENDING' });
            setup_1.prismaMock.contractorQuote.update.mockResolvedValue({ id: 1, status: 'SENT' });
            const response = yield (0, supertest_1.default)(contractorApp)
                .post('/api/quotes/1/submit')
                .send({ totalAmount: 1500, executionDays: 14, acceptsBOM: true });
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('SENT');
        }));
    });
});
