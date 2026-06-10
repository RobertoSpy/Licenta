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
const projectRoutes_1 = __importDefault(require("../projectRoutes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mocam securitatea pentru a simula utilizatorul 1 (Client autentificat)
jest.mock('../../../core/middleware/authMiddleware', () => ({
    protect: (req, res, next) => {
        req.user = { id: 1 };
        next();
    }
}));
app.use('/api/projects', projectRoutes_1.default);
describe('Projects & Configurator API (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('GET /api/projects - ar trebui sa listeze toate proiectele userului curent', () => __awaiter(void 0, void 0, void 0, function* () {
        // Returnăm un array mock-uit din Prisma
        setup_1.prismaMock.project.findMany.mockResolvedValue([
            { id: 10, title: 'Casa Visurilor', userId: 1, wizardStep: 4, isCompleted: true }
        ]);
        const response = yield (0, supertest_1.default)(app).get('/api/projects');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body[0].title).toBe('Casa Visurilor');
    }));
    it('POST /api/projects - ar trebui sa creeze un proiect nou', () => __awaiter(void 0, void 0, void 0, function* () {
        // Simulăm crearea cu succes în DB
        setup_1.prismaMock.project.create.mockResolvedValue({
            id: 11,
            title: 'Proiect nou de test',
            userId: 1,
            createdAt: new Date()
        });
        const response = yield (0, supertest_1.default)(app)
            .post('/api/projects')
            .send({ title: 'Proiect nou de test' });
        expect(response.status).toBe(201);
        expect(response.body.title).toBe('Proiect nou de test');
    }));
});
