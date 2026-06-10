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
const prisma_1 = require("../../../lib/prisma");
const normativeChunkRepository_1 = require("../normativeChunkRepository");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        $queryRawUnsafe: jest.fn(),
        $queryRaw: jest.fn(),
        normativeChunk: {
            findMany: jest.fn(),
        },
    },
}));
describe('normativeChunkRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('findSimilar', () => {
        it('ar trebui sa apeleze prisma.$queryRawUnsafe cu vectorul si limita corecta', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResult = [{ source: 'NP112', similarity: 0.9 }];
            prisma_1.prisma.$queryRawUnsafe.mockResolvedValue(mockResult);
            const result = yield normativeChunkRepository_1.normativeChunkRepository.findSimilar('[0.1, 0.2]', 5);
            expect(prisma_1.prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('SELECT "source", "chapter", "content", "agent"'), '[0.1, 0.2]', 5);
            expect(prisma_1.prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('status" != \'abrogat\''), expect.anything(), expect.anything());
            expect(result).toEqual(mockResult);
        }));
    });
    describe('findSimilarByAgent', () => {
        it('ar trebui sa apeleze prisma.$queryRawUnsafe incluzand conditia de agent', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResult = [{ source: 'P100', similarity: 0.85 }];
            prisma_1.prisma.$queryRawUnsafe.mockResolvedValue(mockResult);
            const result = yield normativeChunkRepository_1.normativeChunkRepository.findSimilarByAgent('[0.3, 0.4]', 3, 'seismic');
            expect(prisma_1.prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('"agent" = $3'), '[0.3, 0.4]', 3, 'seismic');
            expect(result).toEqual(mockResult);
        }));
    });
    describe('countByAgent', () => {
        it('ar trebui sa apeleze prisma.$queryRaw pentru a aduce gruparile de agenti', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResult = [{ agent: 'seismic', count: BigInt(10) }];
            prisma_1.prisma.$queryRaw.mockResolvedValue(mockResult);
            const result = yield normativeChunkRepository_1.normativeChunkRepository.countByAgent();
            expect(prisma_1.prisma.$queryRaw).toHaveBeenCalled();
            expect(result).toEqual(mockResult);
        }));
    });
    describe('findChunksByIds', () => {
        it('ar trebui sa apeleze findMany cu un array de ID-uri', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResult = [{ id: 1, source: 'A' }, { id: 2, source: 'B' }];
            prisma_1.prisma.normativeChunk.findMany.mockResolvedValue(mockResult);
            const result = yield normativeChunkRepository_1.normativeChunkRepository.findChunksByIds([1, 2]);
            expect(prisma_1.prisma.normativeChunk.findMany).toHaveBeenCalledWith({
                where: { id: { in: [1, 2] } }
            });
            expect(result).toEqual(mockResult);
        }));
    });
});
