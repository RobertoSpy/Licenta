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
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rateLimiter_1 = require("../middleware/rateLimiter");
describe('Infrastructure & Security Shield (Integration)', () => {
    let app;
    beforeEach(() => {
        app = (0, express_1.default)();
        app.use(express_1.default.json());
    });
    describe('Helmet & CORS Policies', () => {
        it('ar trebui sa aplice antetele de securitate Helmet impotriva XSS si Clickjacking', () => __awaiter(void 0, void 0, void 0, function* () {
            app.use((0, helmet_1.default)());
            app.get('/health', (req, res) => res.status(200).send('OK'));
            const res = yield (0, supertest_1.default)(app).get('/health');
            // Helmet setează automat o serie de antete stricte de securitate
            expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
            expect(res.headers['x-dns-prefetch-control']).toBe('off');
            expect(res.headers['strict-transport-security']).toBeDefined();
            expect(res.headers['content-security-policy']).toBeDefined();
        }));
        it('ar trebui sa respinga atacurile CORS (Cross-Origin Resource Sharing) malitioase', () => __awaiter(void 0, void 0, void 0, function* () {
            app.use((0, cors_1.default)({ origin: 'https://buildconstruct.ro' }));
            app.get('/health', (req, res) => res.status(200).send('OK'));
            const res = yield (0, supertest_1.default)(app)
                .options('/health')
                .set('Origin', 'https://hacker-site.ru');
            // Daca originea e falsa, serverul nu va returna antetul favorabil (va bloca executia pe browser-ul client)
            expect(res.headers['access-control-allow-origin']).not.toBe('https://hacker-site.ru');
        }));
    });
    describe('Rate Limiting (Anti DDoS & Brute Force)', () => {
        it('ar trebui sa blocheze atacurile de tip flood/DDoS', () => __awaiter(void 0, void 0, void 0, function* () {
            // Setăm un limiter global foarte strict exclusiv pentru test (2 requesturi maxime)
            const testGlobalLimiter = (0, express_rate_limit_1.default)({
                windowMs: 60 * 1000,
                max: 2,
                standardHeaders: true,
                legacyHeaders: false,
            });
            app.use('/api', testGlobalLimiter);
            app.get('/api/test', (req, res) => res.status(200).send('OK'));
            // Utilizator legitim
            yield (0, supertest_1.default)(app).get('/api/test').expect(200);
            yield (0, supertest_1.default)(app).get('/api/test').expect(200);
            // Bot / Hacker care incearca a 3-a oara
            const res = yield (0, supertest_1.default)(app).get('/api/test');
            expect(res.status).toBe(429); // 429 Too Many Requests
            expect(res.text).toContain('Too many requests');
        }));
        it('ar trebui sa blocheze atacurile brute-force tintite strict pe un anumit cont de email, protejand restul platformei', () => __awaiter(void 0, void 0, void 0, function* () {
            // Folosim instanța reală din cod (10 încercări max)
            app.post('/api/auth/login', rateLimiter_1.authEmailLimiter, (req, res) => res.status(200).send('LOGIN_OK'));
            // Hackerul incearca parola gresita de 10 ori pe contul lui Roberto
            for (let i = 0; i < 10; i++) {
                yield (0, supertest_1.default)(app)
                    .post('/api/auth/login')
                    .send({ email: 'roberto@example.com' })
                    .expect(200);
            }
            // La a 11-a oară, serverul il baneaza!
            const blockedRes = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({ email: 'roberto@example.com' });
            expect(blockedRes.status).toBe(429);
            expect(blockedRes.text).toContain('Prea multe încercări pentru acest cont');
            // Dar un ALT utilizator legitim trebuie sa poata intra simultan
            const legitimateUserRes = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({ email: 'alt_utilizator@example.com' });
            expect(legitimateUserRes.status).toBe(200);
        }));
    });
});
