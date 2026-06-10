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
const exportRoutes_1 = __importDefault(require("../exportRoutes"));
const exportService_1 = require("../exportService");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mock middleware
jest.mock('../../../core/middleware/authMiddleware', () => ({
    protect: (req, res, next) => {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        req.user = { id: 1, role: 'CLIENT' };
        next();
    }
}));
jest.mock('../../../core/middleware/tenantGuard', () => ({
    tenantGuard: (req, res, next) => {
        if (req.params.projectId === '99') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    }
}));
jest.mock('../exportService');
app.use('/api/export', exportRoutes_1.default);
describe('Export API (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('Method Validation (405)', () => {
        it('GET instead of POST returns 405 (method not allowed)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).get('/api/export/plan-pdf/1').set('Authorization', 'Bearer token');
            expect(res.status).toBe(405);
            expect(res.body.message).toBe('Method Not Allowed');
        }));
        it('PUT instead of POST returns 405', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).put('/api/export/contractor-pdf/1').set('Authorization', 'Bearer token');
            expect(res.status).toBe(405);
            expect(res.body.message).toBe('Method Not Allowed');
        }));
    });
    describe('Authentication & Authorization', () => {
        it('returns 401 without authentication token', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/export/plan-pdf/1');
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Unauthorized');
        }));
        it('tenantGuard blocks access to other user projects (403)', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).post('/api/export/plan-pdf/99').set('Authorization', 'Bearer token');
            expect(res.status).toBe(403);
            expect(res.body.message).toBe('Forbidden');
        }));
    });
    describe('Success path', () => {
        it('returns 200 and PDF buffer when calling POST /plan-pdf/:id', () => __awaiter(void 0, void 0, void 0, function* () {
            exportService_1.exportService.generatePlanPdf.mockResolvedValue({
                filename: 'test.pdf',
                buffer: Buffer.from('PDF_DATA')
            });
            const res = yield (0, supertest_1.default)(app)
                .post('/api/export/plan-pdf/1')
                .set('Authorization', 'Bearer token');
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toBe('application/pdf');
            expect(res.body).toBeInstanceOf(Buffer);
        }));
        it('returns 200 and PDF buffer when calling POST /contractor-pdf/:quoteId', () => __awaiter(void 0, void 0, void 0, function* () {
            exportService_1.exportService.generateContractorPdf.mockResolvedValue({
                filename: 'contractor.pdf',
                buffer: Buffer.from('CONTRACTOR_PDF')
            });
            const res = yield (0, supertest_1.default)(app)
                .post('/api/export/contractor-pdf/1')
                .set('Authorization', 'Bearer token');
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toBe('application/pdf');
        }));
    });
});
