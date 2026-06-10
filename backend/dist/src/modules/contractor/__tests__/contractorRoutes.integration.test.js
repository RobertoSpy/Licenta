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
const contractorRoutes_1 = __importDefault(require("../contractorRoutes"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mock jwt.verify to return specific users
jest.mock('jsonwebtoken');
// Adaugam ruta de contractor
app.use('/api/contractors', contractorRoutes_1.default);
describe('Contractor Routes (Integration)', () => {
    let tokenClient;
    let tokenContractor;
    beforeAll(() => {
        tokenClient = 'valid-client-token';
        tokenContractor = 'valid-contractor-token';
    });
    beforeEach(() => {
        jest.clearAllMocks();
        jsonwebtoken_1.default.verify.mockImplementation((token) => {
            if (token === tokenClient)
                return { id: 10, role: 'CLIENT' };
            if (token === tokenContractor)
                return { id: 20, role: 'CONTRACTOR' };
            throw new Error('Invalid token');
        });
        // Mockam un utilizator in baza de date ca sa treaca de authMiddleware
        setup_1.prismaMock.user.findUnique.mockImplementation(((args) => __awaiter(void 0, void 0, void 0, function* () {
            if (args.where.id === 10)
                return { id: 10, role: 'CLIENT', status: 'ACTIVE' };
            if (args.where.id === 20)
                return { id: 20, role: 'CONTRACTOR', status: 'ACTIVE' };
            return null;
        })));
    });
    describe('Authorization and Roles', () => {
        it('GET /me/profile returns 401 without token', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).get('/api/contractors/me/profile');
            expect(res.status).toBe(401);
        }));
        it('GET /me/profile returns 403 for CLIENT (requires CONTRACTOR)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .get('/api/contractors/me/profile')
                .set('Authorization', `Bearer ${tokenClient}`);
            expect(res.status).toBe(403);
        }));
        it('POST /1/reviews returns 403 for CONTRACTOR (requires CLIENT)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .post('/api/contractors/1/reviews')
                .set('Authorization', `Bearer ${tokenContractor}`)
                .send({ rating: 5, comment: 'Good', projectId: 100 });
            expect(res.status).toBe(403);
        }));
    });
    describe('Validation', () => {
        it('POST /:id/reviews returns 400 for invalid rating', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .post('/api/contractors/1/reviews')
                .set('Authorization', `Bearer ${tokenClient}`)
                .send({ rating: 6, comment: 'Good', projectId: 100 });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Rating invalid');
            const resZero = yield (0, supertest_1.default)(app)
                .post('/api/contractors/1/reviews')
                .set('Authorization', `Bearer ${tokenClient}`)
                .send({ rating: 0, comment: 'Good', projectId: 100 });
            expect(resZero.status).toBe(400);
            const resFloat = yield (0, supertest_1.default)(app)
                .post('/api/contractors/1/reviews')
                .set('Authorization', `Bearer ${tokenClient}`)
                .send({ rating: 4.5, comment: 'Good', projectId: 100 });
            expect(resFloat.status).toBe(400);
        }));
        it('POST /:id/reviews returns 400 for empty or too long comment', () => __awaiter(void 0, void 0, void 0, function* () {
            const resEmpty = yield (0, supertest_1.default)(app)
                .post('/api/contractors/1/reviews')
                .set('Authorization', `Bearer ${tokenClient}`)
                .send({ rating: 5, comment: '   ', projectId: 100 });
            expect(resEmpty.status).toBe(400);
            expect(resEmpty.body.message).toBe('Comentariu invalid');
            const resLong = yield (0, supertest_1.default)(app)
                .post('/api/contractors/1/reviews')
                .set('Authorization', `Bearer ${tokenClient}`)
                .send({ rating: 5, comment: 'a'.repeat(1001), projectId: 100 });
            expect(resLong.status).toBe(400);
        }));
        it('POST /:id/reviews returns 400 for invalid projectId', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .post('/api/contractors/1/reviews')
                .set('Authorization', `Bearer ${tokenClient}`)
                .send({ rating: 5, comment: 'Good', projectId: 'abc' });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Proiectul trebuie specificat');
        }));
        it('GET /:id returns 400 for invalid contractorId (NaN)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .get('/api/contractors/abc')
                .set('Authorization', `Bearer ${tokenClient}`);
            expect(res.status).toBe(400);
        }));
    });
    describe('Happy Paths', () => {
        it('GET /me/profile returns 200 for CONTRACTOR', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.contractorProfile.findUnique.mockResolvedValue({ id: 1, companyName: 'Test' });
            const res = yield (0, supertest_1.default)(app)
                .get('/api/contractors/me/profile')
                .set('Authorization', `Bearer ${tokenContractor}`);
            expect(res.status).toBe(200);
            expect(res.body.companyName).toBe('Test');
        }));
        it('POST /:id/reviews returns 200 on success', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock quote checking
            setup_1.prismaMock.contractorQuote.findFirst.mockResolvedValue({ id: 1, status: 'ACCEPTED' });
            // Mock duplicate checking
            setup_1.prismaMock.contractorReview.findFirst.mockResolvedValue(null);
            // Mock review creation
            setup_1.prismaMock.contractorReview.create.mockResolvedValue({ id: 1, rating: 5 });
            // Mock avgRating recalc
            setup_1.prismaMock.contractorReview.findMany.mockResolvedValue([{ rating: 5 }]);
            // Mock update
            setup_1.prismaMock.contractorProfile.update.mockResolvedValue({ id: 1 });
            const res = yield (0, supertest_1.default)(app)
                .post('/api/contractors/1/reviews')
                .set('Authorization', `Bearer ${tokenClient}`)
                .send({ rating: 5, comment: 'Super', projectId: 100 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        }));
    });
});
