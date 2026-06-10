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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const setup_1 = require("../../../../tests/setup");
const editorRoutes_1 = __importDefault(require("../editorRoutes"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const agentOrchestrator_1 = require("../../ai/services/agentOrchestrator");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mock jwt.verify to return specific users
jest.mock('jsonwebtoken');
// Adaugam ruta de editor
app.use('/api/editor', editorRoutes_1.default);
describe('Editor Routes (Integration)', () => {
    let token;
    beforeAll(() => {
        token = 'valid-token';
    });
    beforeEach(() => {
        jest.clearAllMocks();
        jsonwebtoken_1.default.verify.mockImplementation(() => {
            return { id: 10, role: 'CLIENT' };
        });
        // Mockam un utilizator in baza de date
        setup_1.prismaMock.user.findUnique.mockImplementation((args) => __awaiter(void 0, void 0, void 0, function* () {
            if (args.where.id === 10)
                return { id: 10, role: 'CLIENT', status: 'ACTIVE' };
            return null;
        }));
        // Mockam tenantGuard prin projectRepository
        setup_1.prismaMock.project.findUnique.mockResolvedValue({ id: 1, userId: 10 });
    });
    describe('Authorization and Validation', () => {
        it('GET /snapshots/:projectId returns 401 without token', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app).get('/api/editor/snapshots/1');
            expect(res.status).toBe(401);
        }));
        it('GET /snapshots/:projectId returns 400 for NaN projectId', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .get('/api/editor/snapshots/abc')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
        }));
        it('GET /snapshots/single/:id returns 400 for NaN snapshotId', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .get('/api/editor/snapshots/single/abc')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
        }));
        it('PATCH /snapshots/:id/publish returns 403 when ownership fails (cross-project ref)', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mockam snapshot findUnique sa returneze un snapshot care nu ne apartine sau dintr-un alt proiect
            setup_1.prismaMock.planSnapshot.findUnique.mockResolvedValue({
                id: 999,
                project: { id: 2, userId: 10 } // apartine userului, dar alt proiect (2 in loc de 1)
            });
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/editor/snapshots/999/publish')
                .set('Authorization', `Bearer ${token}`)
                .send({ projectId: 1 });
            expect(res.status).toBe(403);
            expect(res.body.message).toContain('Acces interzis sau snapshot-ul nu aparține acestui proiect');
        }));
        it('PATCH /snapshots/:id/publish does not expose which link failed (returns 403 on total failure)', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findUnique.mockResolvedValue(null);
            const res = yield (0, supertest_1.default)(app)
                .patch('/api/editor/snapshots/999/publish')
                .set('Authorization', `Bearer ${token}`)
                .send({ projectId: 1 });
            expect(res.status).toBe(403);
        }));
    });
    describe('SSE explain-conformity', () => {
        it('POST /explain-conformity returns 400 for empty violations array', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .post('/api/editor/explain-conformity')
                .set('Authorization', `Bearer ${token}`)
                .send({ violations: [] });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Validation failed');
        }));
        it('POST /explain-conformity returns 400 for malformed violation', () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app)
                .post('/api/editor/explain-conformity')
                .set('Authorization', `Bearer ${token}`)
                .send({ violations: [{ label: 'test' }] }); // missing other fields
            expect(res.status).toBe(400);
        }));
        it('POST /explain-conformity returns content-type text/event-stream and formats correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock agentOrchestrator to yield dummy chunks
            function dummyStream() {
                return __asyncGenerator(this, arguments, function* dummyStream_1() {
                    yield yield __await({ text: 'Hello' });
                    yield yield __await({ text: ' World' });
                });
            }
            jest.spyOn(agentOrchestrator_1.agentOrchestrator, 'getAiStreamForChat').mockResolvedValue(dummyStream());
            const response = yield (0, supertest_1.default)(app)
                .post('/api/editor/explain-conformity')
                .set('Authorization', `Bearer ${token}`)
                .send({ violations: [{ label: 'Living', usableSqm: 16, minRequired: 18 }] })
                .buffer(true)
                .parse((res, callback) => {
                let data = '';
                res.on('data', chunk => { data += chunk.toString(); });
                res.on('end', () => callback(null, data));
            });
            expect(response.headers['content-type']).toContain('text/event-stream');
            const text = response.body;
            expect(text).toContain('data: {"text":"Hello"}\n\n');
            expect(text).toContain('data: {"text":" World"}\n\n');
            expect(text).toContain('data: [DONE]\n\n');
        }));
    });
});
