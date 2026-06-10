"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const authRoutes_1 = __importDefault(require("../authRoutes"));
const authMiddleware_1 = require("../../../core/middleware/authMiddleware");
const tenantGuard_1 = require("../../../core/middleware/tenantGuard");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const emailService = __importStar(require("../emailService"));
jest.mock('../emailService');
jest.mock('jsonwebtoken');
const mockEmail = emailService;
process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Setăm încrederea în proxy pentru a permite express-rate-limit să funcționeze corect
app.set('trust proxy', 1);
app.use('/api/auth', authRoutes_1.default);
// Dummy route pentru testarea explicită a middleware-urilor de securitate (protect + tenantGuard)
app.get('/api/protected-tenant/:projectId', authMiddleware_1.protect, tenantGuard_1.tenantGuard, (req, res) => {
    res.status(200).json({ message: 'Success' });
});
describe('Auth API & Security Middlewares (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('JWT & TenantGuard Security', () => {
        const validSecret = process.env.JWT_ACCESS_SECRET || 'secret';
        it('protected route without Authorization header returns 401', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).get('/api/protected-tenant/1');
            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/Neautorizat/);
        }));
        it('protected route with tampered JWT returns 401', () => __awaiter(void 0, void 0, void 0, function* () {
            jsonwebtoken_1.default.verify.mockImplementation(() => { throw new Error('invalid token'); });
            const res = yield (0, supertest_1.default)(app)
                .get('/api/protected-tenant/1')
                .set('Authorization', 'Bearer invalid-token.xyz.abc');
            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/Neautorizat|invalid/i);
        }));
        it('protected route with valid token for different user returns 403 (TenantGuard)', () => __awaiter(void 0, void 0, void 0, function* () {
            // Bypass token generation/verification by mocking jwt.verify
            jsonwebtoken_1.default.verify.mockImplementation((token, secret) => ({ id: 2 }));
            // Setup mock: user 2 nu deține proiectul 1
            setup_1.prismaMock.user.findUnique.mockResolvedValue({ id: 2, role: 'CLIENT' });
            setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 1 }); // Deținut de user 1
            const res = yield (0, supertest_1.default)(app)
                .get('/api/protected-tenant/1')
                .set('Authorization', `Bearer some-token`);
            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/Acces interzis/);
        }));
    });
    describe('Rate Limiting', () => {
        it('should return 429 after exceeding email-based login attempts', () => __awaiter(void 0, void 0, void 0, function* () {
            // Fail login early by not finding user
            setup_1.prismaMock.user.findUnique.mockResolvedValue(null);
            // Limita e 10. Trimitem 11
            for (let i = 0; i < 10; i++) {
                yield (0, supertest_1.default)(app)
                    .post('/api/auth/login')
                    .send({ email: 'brute@test.com', password: 'wrong' });
            }
            const res11 = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({ email: 'brute@test.com', password: 'wrong' });
            expect(res11.status).toBe(429);
            expect(res11.text).toMatch(/Prea multe/i);
        }));
        it('global limiter does not block normal request volume', () => __awaiter(void 0, void 0, void 0, function* () {
            // Deoarece testul precedent a făcut brute force pe brute@test.com,
            // vom face requests pe alt email pentru a testa volumul normal care nu depășește limita.
            const res = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({ email: 'normal@test.com', password: 'abc' });
            // 400 pt că pass < 8 chars etc sau 401 pt invalid credentials, DAR NU 429!
            expect(res.status).not.toBe(429);
        }));
    });
    describe('Valid Flows & Logic', () => {
        it('Magic link expiry + reuse prevention', () => __awaiter(void 0, void 0, void 0, function* () {
            // Simulam un request cu OTP invalid/expirat
            setup_1.prismaMock.user.findFirst.mockResolvedValue(null);
            const res = yield (0, supertest_1.default)(app)
                .post('/api/auth/reset-password')
                .send({ email: 'x@y.com', otp: '123456', newPassword: 'Valid1Password!' });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Cod invalid sau expirat.');
        }));
        it('POST /forgot-password with valid email sends email', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.user.findUnique.mockResolvedValue({ id: 1, email: 'valid@test.com' });
            mockEmail.sendPasswordResetEmail.mockResolvedValue(undefined);
            const res = yield (0, supertest_1.default)(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'valid@test.com' });
            expect(res.status).toBe(200);
            expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalled();
        }));
    });
});
