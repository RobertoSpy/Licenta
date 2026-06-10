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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const chatPromptBuilder_1 = require("../services/chatPromptBuilder");
describe('chatPromptBuilder', () => {
    describe('buildOffTopicRefusalStream', () => {
        it('ar trebui sa returneze un async generator cu mesaje de refuz clare', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            const stream = (0, chatPromptBuilder_1.buildOffTopicRefusalStream)();
            const chunks = [];
            try {
                for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                    _c = stream_1_1.value;
                    _d = false;
                    const chunk = _c;
                    chunks.push(chunk.text);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            expect(chunks.length).toBe(3);
            expect(chunks[0]).toContain('nu pare legată de construcția');
            expect(chunks[1]).toContain('Sunt specializat');
            expect(chunks[2]).toContain('Ce te interesează');
        }));
    });
    describe('buildChatPrompt', () => {
        const baseInput = {
            userQuestion: 'Cat ciment imi trebuie?',
            contextString: 'Context proiect',
            activeAgents: ['structural'],
            statusDisclaimer: '[Disclaimer Test]',
            ragContext: 'Normative extrase RAG'
        };
        it('ar trebui sa injecteze corect screenContext pentru "screen1" (faza teren/wizard)', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(Object.assign(Object.assign({}, baseInput), { screenContext: 'screen1' }));
            expect(prompt).toContain('CONTEXT SPECIAL — FAZA 1: WIZARD & TEREN');
            expect(prompt).toContain('Maximum tehnic etaje');
            expect(prompt).not.toContain('CONTEXT SPECIAL — FAZA 3');
        });
        it('ar trebui sa injecteze corect screenContext pentru "editor"', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(Object.assign(Object.assign({}, baseInput), { screenContext: 'editor' }));
            expect(prompt).toContain('CONTEXT SPECIAL — FAZA 2: EDITOR 2D');
            expect(prompt).toContain('cum să deseneze corect o casă');
        });
        it('ar trebui sa injecteze corect screenContext pentru "bom"', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(Object.assign(Object.assign({}, baseInput), { screenContext: 'bom' }));
            expect(prompt).toContain('CONTEXT SPECIAL — FAZA 3: DEVIZ & MATERIALE');
        });
        it('ar trebui sa injecteze corect screenContext pentru "energy"', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(Object.assign(Object.assign({}, baseInput), { screenContext: 'energy' }));
            expect(prompt).toContain('CONTEXT SPECIAL — EFICIENȚĂ ENERGETICĂ');
        });
        it('ar trebui sa injecteze corect screenContext pentru "market"', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(Object.assign(Object.assign({}, baseInput), { screenContext: 'market' }));
            expect(prompt).toContain('CONTEXT SPECIAL — ANALIZĂ PIAȚĂ CONSTRUCȚII');
            expect(prompt).toContain('INSSE CNS107D');
        });
        it('ar trebui sa returneze un prompt fara screen context special daca screen este necunoscut', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(Object.assign(Object.assign({}, baseInput), { screenContext: 'unknown' }));
            expect(prompt).not.toContain('CONTEXT SPECIAL PENTRU ECRAN');
        });
        it('ar trebui sa includa istoricul conversatiei daca este furnizat', () => {
            const history = [
                { role: 'user', text: 'Salut' },
                { role: 'model', text: 'Buna!' }
            ];
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(Object.assign(Object.assign({}, baseInput), { conversationHistory: history }));
            expect(prompt).toContain('ISTORIC CONVERSAȚIE:');
            expect(prompt).toContain('[Utilizator]: Salut');
            expect(prompt).toContain('[Zidario]: Buna!');
        });
        it('ar trebui sa includa summary-ul din istoricul lung daca este furnizat', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(Object.assign(Object.assign({}, baseInput), { historySummary: 'Rezumat conversatie anterioara' }));
            expect(prompt).toContain('=== CONTEXT PROIECT (din conversații anterioare) ===');
            expect(prompt).toContain('Rezumat conversatie anterioara');
        });
        it('ar trebui sa asigure existenta textelor de reglementare RAG in prompt', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(baseInput);
            expect(prompt).toContain('REGLEMENTĂRI RELEVANTE DIN NORMATIVE (RAG — Hybrid Search):');
            expect(prompt).toContain('Normative extrase RAG');
        });
        it('ar trebui sa includa intrebarea finala a utilizatorului in prompt', () => {
            const prompt = (0, chatPromptBuilder_1.buildChatPrompt)(baseInput);
            expect(prompt).toContain('ÎNTREBARE UTILIZATOR:');
            expect(prompt).toContain('Cat ciment imi trebuie?');
        });
    });
});
