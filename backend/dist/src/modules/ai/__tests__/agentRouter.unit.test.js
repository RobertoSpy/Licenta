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
Object.defineProperty(exports, "__esModule", { value: true });
const agentRouter_1 = require("../services/agentRouter");
const embeddingService_1 = require("../services/embeddingService");
jest.mock('../services/embeddingService', () => ({
    embeddingService: {
        embed: jest.fn()
    }
}));
describe('AI Agent Router Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        embeddingService_1.embeddingService.embed.mockImplementation((text) => __awaiter(void 0, void 0, void 0, function* () {
            // Agent descriptions
            if (text.includes('Informații despre sol'))
                return [1, 0, 0]; // geotehnic
            if (text.includes('Costuri, prețuri'))
                return [0, 1, 0]; // deviz
            // Test questions
            if (text === 'intrebare_sub_limita')
                return [0.5, 0.5, 0.5]; // ~0.57 similarity with both
            if (text === 'intrebare_peste_limita')
                return [0.65, 0, 0.76]; // matches geotehnic (0.65), doesn't match deviz (0)
            if (text === 'intrebare_multi_agenti')
                return [0.65, 0.65, 0.39]; // matches both
            return [0, 0, 0];
        }));
    });
    describe('isOffTopic', () => {
        it('ar trebui sa returneze true pentru un subiect culinar (off-topic)', () => {
            expect((0, agentRouter_1.isOffTopic)('Cum fac o rețetă de pizza?')).toBe(true);
        });
        it('ar trebui sa returneze false pentru un subiect de constructii', () => {
            expect((0, agentRouter_1.isOffTopic)('Cum torn fundația la casa mea?')).toBe(false);
        });
        it('ar trebui sa returneze true pentru subiecte politice', () => {
            expect((0, agentRouter_1.isOffTopic)('Cine iese președinte anul asta?')).toBe(true);
        });
    });
    describe('detectRequiredAgents - Regex Routing', () => {
        it('ar trebui sa returneze [geotehnic] cand se pune o intrebare despre pamant/sol', () => __awaiter(void 0, void 0, void 0, function* () {
            const agents = yield (0, agentRouter_1.detectRequiredAgents)('Cat trebuie sa sap in pamant?', 'screen1');
            expect(agents).toContain('geotehnic');
        }));
        it('ar trebui sa aplice fallback bazat pe screen daca nicio categorie nu e direct gasita si fara semantic', () => __awaiter(void 0, void 0, void 0, function* () {
            const agents = yield (0, agentRouter_1.detectRequiredAgents)('Vreau să fac ceva neobisnuit', 'screen4');
            expect(agents).toEqual(expect.arrayContaining(['legal', 'architectural']));
        }));
        it('ar trebui sa forteze financial cand ne aflam pe ecranul market', () => __awaiter(void 0, void 0, void 0, function* () {
            const agents = yield (0, agentRouter_1.detectRequiredAgents)('Mă gândesc să încep', 'market');
            expect(agents).toContain('financial');
        }));
        it('ar trebui sa asigure fallback [legal] daca ecranul nu exista si nici regexul nu prinde', () => __awaiter(void 0, void 0, void 0, function* () {
            const agents = yield (0, agentRouter_1.detectRequiredAgents)('Salut', 'unknown_screen');
            expect(agents).toContain('legal');
        }));
        it('ar trebui sa introduca asistentul "deviz" si "materiale" cand se pune o intrebare legata de costuri', () => __awaiter(void 0, void 0, void 0, function* () {
            const agents = yield (0, agentRouter_1.detectRequiredAgents)('cat ma costa fierul pentru stalp?', 'screen3');
            expect(agents).toContain('deviz');
            expect(agents).toContain('materiale');
            expect(agents).toContain('structural');
        }));
    });
    describe('detectRequiredAgents - Semantic Routing Thresholds', () => {
        it('ar trebui sa respinga agentul daca similaritatea cosinus este 0.592 (sub pragul de 0.60)', () => __awaiter(void 0, void 0, void 0, function* () {
            const agents = yield (0, agentRouter_1.detectRequiredAgents)('intrebare_sub_limita', 'unknown_screen');
            expect(agents).not.toContain('geotehnic');
            expect(agents).toContain('legal');
        }));
        it('ar trebui sa admita agentul daca similaritatea cosinus este 0.649 (peste pragul de 0.60)', () => __awaiter(void 0, void 0, void 0, function* () {
            const agents = yield (0, agentRouter_1.detectRequiredAgents)('intrebare_peste_limita', 'unknown_screen');
            expect(agents).toContain('geotehnic');
            expect(agents).not.toContain('legal'); // a gasit ceva, nu face fallback
        }));
        it('ar trebui sa admita agentul dominant si pe cel secundar (amandoi > 0.60) cu includerea dependintelor (deviz -> materiale)', () => __awaiter(void 0, void 0, void 0, function* () {
            const agents = yield (0, agentRouter_1.detectRequiredAgents)('intrebare_multi_agenti', 'unknown_screen');
            expect(agents).toContain('geotehnic');
            expect(agents).toContain('deviz');
            expect(agents).toContain('materiale');
        }));
    });
});
