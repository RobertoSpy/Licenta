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
const aiController_1 = require("../aiController");
const agentOrchestrator_1 = require("../services/agentOrchestrator");
const chatSummaryRepository_1 = require("../chatSummaryRepository");
const projectRepository_1 = require("../../project/projectRepository");
// Mock dependencies
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: jest.fn().mockResolvedValue({ text: 'Mock response' }),
            generateContentStream: jest.fn().mockImplementation(function () {
                return __asyncGenerator(this, arguments, function* () {
                    yield yield __await({ text: 'Stream part' });
                });
            }),
            embedContent: jest.fn().mockResolvedValue({
                embeddings: [{ values: [0.1, 0.2, 0.3] }]
            })
        }
    }))
}));
jest.mock('../services/agentOrchestrator');
jest.mock('../chatSummaryRepository');
jest.mock('../../project/projectRepository');
jest.mock('../services/ragService', () => ({
    searchHybrid: jest.fn().mockResolvedValue([{ content: 'Mock RAG content', source: 'CR6', chapter: '1.2' }])
}));
jest.mock('../services/materialAnalyzer', () => ({
    materialAnalyzer: {
        explainMaterial: jest.fn().mockImplementation(function () {
            return __asyncGenerator(this, arguments, function* () {
                yield yield __await('Stream part');
            });
        }),
        explainMaterialById: jest.fn().mockImplementation(function () {
            return __asyncGenerator(this, arguments, function* () {
                yield yield __await('Stream part by ID');
            });
        })
    }
}));
jest.mock('../services/aiClient', () => ({
    getAi: jest.fn(),
    FALLBACK_MODELS_CHAT: ['model-1']
}));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Simplest mock routes mapped directly to controller methods
app.post('/api/ai/chat', aiController_1.aiController.chatStream);
app.post('/api/ai/summary', aiController_1.aiController.saveSummary);
app.get('/api/ai/summary/:projectId', aiController_1.aiController.getSummary);
app.post('/api/ai/suggest-rooms', aiController_1.aiController.suggestRooms);
app.post('/api/ai/summarize', aiController_1.aiController.summarizeConversation);
app.post('/api/ai/validate-override', aiController_1.validateMaterialOverride);
app.get('/api/ai/explain', aiController_1.aiController.explainMaterial);
app.post('/api/ai/explain', aiController_1.aiController.explainMaterial);
app.get('/api/ai/explain/:materialId', aiController_1.aiController.explainMaterialById);
describe('aiController (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GEMINI_API_KEY = 'test_key';
    });
    describe('POST /api/ai/chat', () => {
        it('ar trebui sa returneze 400 daca nu exista mesaj', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app).post('/api/ai/chat').send({});
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Mesajul este obligatoriu.');
        }));
        it('ar trebui sa seteze headerele SSE si sa scrie date din stream', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock-uim un stream asincron simplu
            function mockStream() {
                return __asyncGenerator(this, arguments, function* mockStream_1() {
                    yield yield __await({ text: 'Hello' });
                    yield yield __await({ text: ' World' });
                });
            }
            agentOrchestrator_1.agentOrchestrator.getAiStreamForChat.mockResolvedValue(mockStream());
            const response = yield (0, supertest_1.default)(app)
                .post('/api/ai/chat')
                .send({ message: 'Salut', screenContext: 'screen1' });
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('text/event-stream');
            expect(response.text).toContain('data: {"text":"Hello"}');
            expect(response.text).toContain('data: {"text":" World"}');
            expect(response.text).toContain('data: [DONE]');
            expect(agentOrchestrator_1.agentOrchestrator.getAiStreamForChat).toHaveBeenCalledWith('Salut', 'Fără context special generat din formularul anterior.', [], 'screen1', null);
        }));
    });
    describe('POST /api/ai/summary', () => {
        it('ar trebui sa salveze rezumatul', () => __awaiter(void 0, void 0, void 0, function* () {
            chatSummaryRepository_1.chatSummaryRepository.upsert.mockResolvedValue({ id: 10 });
            const response = yield (0, supertest_1.default)(app)
                .post('/api/ai/summary')
                .send({ projectId: 1, phase: 'faza1', summary: 'test' });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(chatSummaryRepository_1.chatSummaryRepository.upsert).toHaveBeenCalledWith(1, 'faza1', null, 'test');
        }));
        it('ar trebui sa returneze 400 daca lipsesc date', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app).post('/api/ai/summary').send({ projectId: 1 });
            expect(response.status).toBe(400);
        }));
    });
    describe('GET /api/ai/summary/:projectId', () => {
        it('ar trebui sa returneze rezumatul existent', () => __awaiter(void 0, void 0, void 0, function* () {
            chatSummaryRepository_1.chatSummaryRepository.getOne.mockResolvedValue({ summary: 'istoric' });
            const response = yield (0, supertest_1.default)(app).get('/api/ai/summary/1?phase=faza1&screen=screen1');
            expect(response.status).toBe(200);
            expect(response.body.summary).toBe('istoric');
            expect(chatSummaryRepository_1.chatSummaryRepository.getOne).toHaveBeenCalledWith(1, 'faza1', 'screen1');
        }));
    });
    describe('POST /api/ai/suggest-rooms', () => {
        it('ar trebui sa returneze 400 pt budgetCategory invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/ai/suggest-rooms')
                .send({ projectId: 1, familySize: 4, budgetCategory: 'invalid', houseAreaSqm: 100 });
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('budgetCategory invalid');
        }));
        it('ar trebui sa returneze 404 daca proiectul nu exista', () => __awaiter(void 0, void 0, void 0, function* () {
            projectRepository_1.projectRepository.findById.mockResolvedValue(null);
            const response = yield (0, supertest_1.default)(app)
                .post('/api/ai/suggest-rooms')
                .send({ projectId: 999, familySize: 4, budgetCategory: 'mediu', houseAreaSqm: 100 });
            expect(response.status).toBe(404);
        }));
        it('ar trebui sa returneze suggestiile de la orchestrator in caz de succes', () => __awaiter(void 0, void 0, void 0, function* () {
            projectRepository_1.projectRepository.findById.mockResolvedValue({ id: 1, plotAreaSqm: 500 });
            agentOrchestrator_1.suggestRoomProgram.mockResolvedValue({ rooms: [] });
            const response = yield (0, supertest_1.default)(app)
                .post('/api/ai/suggest-rooms')
                .send({ projectId: 1, familySize: 4, budgetCategory: 'mediu', houseAreaSqm: 100 });
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ rooms: [] });
            expect(agentOrchestrator_1.suggestRoomProgram).toHaveBeenCalled();
        }));
    });
    describe('POST /api/ai/summarize', () => {
        it('ar trebui sa returneze sumarul folosind model.generateContent', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/ai/summarize')
                .send({ text: 'text lung de rezumat' });
            expect(response.status).toBe(200);
            expect(response.body.summary).toBe('Mock response');
        }));
    });
    describe('GET /api/ai/explain', () => {
        it('ar trebui sa returneze o eroare daca lipsesc parametrii base si alt', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app).get('/api/ai/explain');
            expect(response.status).toBe(200); // the API returns 200 with an error in the stream
            expect(response.text).toContain('Eroare: parametri lipsă');
        }));
        it('ar trebui sa returneze stream-ul cu explicatia (GET legacy)', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app).get('/api/ai/explain?base=Caramida&alt=BCA');
            expect(response.status).toBe(200);
            expect(response.text).toContain('Stream part');
        }));
    });
    describe('POST /api/ai/explain', () => {
        it('ar trebui sa returneze o eroare daca lipsesc parametrii (POST)', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app).post('/api/ai/explain').send({});
            expect(response.status).toBe(200);
            expect(response.text).toContain('Eroare: lipsă');
        }));
    });
    describe('GET /api/ai/explain/:materialId', () => {
        it('ar trebui sa returneze 400 daca ID-ul este invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app).get('/api/ai/explain/invalid');
            expect(response.status).toBe(400);
        }));
    });
});
