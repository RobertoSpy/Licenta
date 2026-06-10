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
const ragService_1 = require("../services/ragService");
const embeddingService_1 = require("../services/embeddingService");
const prisma_1 = require("../../../lib/prisma");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        $queryRawUnsafe: jest.fn(),
    },
}));
jest.mock('../services/embeddingService', () => ({
    embeddingService: {
        embed: jest.fn(),
    },
}));
describe('ragService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('searchHybrid', () => {
        it('ar trebui sa returneze array gol daca agentul nu are surse (ex: materiale, deviz)', () => __awaiter(void 0, void 0, void 0, function* () {
            // deviz are 0 surse in AGENT_SOURCES_BY_PURPOSE['residential']
            const result = yield (0, ragService_1.searchHybrid)('cost?', 'deviz', 5);
            expect(result).toEqual([]);
            expect(embeddingService_1.embeddingService.embed).not.toHaveBeenCalled();
            expect(prisma_1.prisma.$queryRawUnsafe).not.toHaveBeenCalled();
        }));
        it('ar trebui sa apeleze prisma.$queryRawUnsafe si sa filtreze pe aplicabilitate', () => __awaiter(void 0, void 0, void 0, function* () {
            embeddingService_1.embeddingService.embed.mockResolvedValue([0.1, 0.2]);
            const mockDbResults = [
                { id: 1, applicability: 'residential', source: 'CR1' },
                { id: 2, applicability: 'commercial', source: 'CR1' } // ar trebui filtrat pentru buildingPurpose=residential
            ];
            prisma_1.prisma.$queryRawUnsafe.mockResolvedValue(mockDbResults);
            const result = yield (0, ragService_1.searchHybrid)('Ce este zapada?', 'structural', 5, undefined, 'residential');
            expect(embeddingService_1.embeddingService.embed).toHaveBeenCalledWith('Ce este zapada?');
            expect(prisma_1.prisma.$queryRawUnsafe).toHaveBeenCalled();
            expect(result.length).toBe(1);
            expect(result[0].id).toBe(1);
        }));
        it('ar trebui sa foloseasca query general cand agentul este "general"', () => __awaiter(void 0, void 0, void 0, function* () {
            embeddingService_1.embeddingService.embed.mockResolvedValue([0.1]);
            prisma_1.prisma.$queryRawUnsafe.mockResolvedValue([]);
            yield (0, ragService_1.searchHybrid)('question', 'general', 5, ['sursa1']);
            // Ar trebui sa fie apelat cu 5 parametri pt general, nu 6 pt agent specific
            // vectorStr, sourcesPgArray, limit, question
            expect(prisma_1.prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('WITH dense_search'), '[0.1]', ['sursa1'], 5, 'question');
        }));
    });
    describe('searchMaterialsHybrid', () => {
        it('ar trebui sa apeleze query hibrid pentru materiale', () => __awaiter(void 0, void 0, void 0, function* () {
            embeddingService_1.embeddingService.embed.mockResolvedValue([0.5]);
            prisma_1.prisma.$queryRawUnsafe.mockResolvedValue([{ id: 1, materialName: 'BCA' }]);
            const result = yield (0, ragService_1.searchMaterialsHybrid)('bca grosime', 3);
            expect(prisma_1.prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('"MaterialChunk" mc'), '[0.5]', 3, 'bca grosime');
            expect(result.length).toBe(1);
            expect(result[0].materialName).toBe('BCA');
        }));
    });
    describe('ragService export functions', () => {
        it('searchRelevantChunks ar trebui sa returneze formatul string', () => __awaiter(void 0, void 0, void 0, function* () {
            embeddingService_1.embeddingService.embed.mockResolvedValue([0.1]);
            prisma_1.prisma.$queryRawUnsafe.mockResolvedValue([
                { source: 'Sursa1', chapter: 'Cap1', content: 'Text 1', applicability: 'mixed' }
            ]);
            const result = yield ragService_1.ragService.searchRelevantChunks('test');
            expect(result).toContain('Fragmente legislative extrase:');
            expect(result).toContain('[Sursa: Sursa1 | Capitol: Cap1]');
            expect(result).toContain('Text 1');
        }));
        it('searchRelevantChunks ar trebui sa trateze erorile gratios', () => __awaiter(void 0, void 0, void 0, function* () {
            embeddingService_1.embeddingService.embed.mockRejectedValue(new Error('Network err'));
            const result = yield ragService_1.ragService.searchRelevantChunks('test');
            expect(result).toBe('Serviciul RAG întâmpină probleme de conectivitate.');
        }));
        it('searchRelevantMaterialChunks ar trebui sa trateze erorile gratios', () => __awaiter(void 0, void 0, void 0, function* () {
            embeddingService_1.embeddingService.embed.mockRejectedValue(new Error('Network err'));
            const result = yield ragService_1.ragService.searchRelevantMaterialChunks('test');
            expect(result).toBe('Serviciul RAG pentru materiale întâmpină probleme.');
        }));
    });
});
