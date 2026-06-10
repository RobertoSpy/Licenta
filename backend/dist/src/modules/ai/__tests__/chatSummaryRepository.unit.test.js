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
const chatSummaryRepository_1 = require("../chatSummaryRepository");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        chatSummary: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));
describe('chatSummaryRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getOne', () => {
        it('ar trebui sa apeleze prisma.chatSummary.findUnique cu argumentele corecte', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResult = { id: 1, summary: 'rezumat' };
            prisma_1.prisma.chatSummary.findUnique.mockResolvedValue(mockResult);
            const result = yield chatSummaryRepository_1.chatSummaryRepository.getOne(1, 'faza1', 'screen1');
            expect(prisma_1.prisma.chatSummary.findUnique).toHaveBeenCalledWith({
                where: { projectId_phase_screen: { projectId: 1, phase: 'faza1', screen: 'screen1' } }
            });
            expect(result).toEqual(mockResult);
        }));
    });
    describe('getMany', () => {
        it('ar trebui sa apeleze prisma.chatSummary.findMany cu argumentele corecte si orderBy createdAt', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResults = [{ id: 1 }, { id: 2 }];
            prisma_1.prisma.chatSummary.findMany.mockResolvedValue(mockResults);
            const result = yield chatSummaryRepository_1.chatSummaryRepository.getMany(1, ['screen1', 'screen2']);
            expect(prisma_1.prisma.chatSummary.findMany).toHaveBeenCalledWith({
                where: { projectId: 1, screen: { in: ['screen1', 'screen2'] } },
                orderBy: { createdAt: 'asc' }
            });
            expect(result).toEqual(mockResults);
        }));
    });
    describe('upsert', () => {
        it('ar trebui sa apeleze prisma.chatSummary.upsert cu argumentele corecte', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResult = { id: 1, summary: 'nou rezumat' };
            prisma_1.prisma.chatSummary.upsert.mockResolvedValue(mockResult);
            const result = yield chatSummaryRepository_1.chatSummaryRepository.upsert(1, 'faza1', 'screen1', 'nou rezumat');
            expect(prisma_1.prisma.chatSummary.upsert).toHaveBeenCalledWith({
                where: { projectId_phase_screen: { projectId: 1, phase: 'faza1', screen: 'screen1' } },
                update: { summary: 'nou rezumat', updatedAt: expect.any(Date) },
                create: { projectId: 1, phase: 'faza1', screen: 'screen1', summary: 'nou rezumat' }
            });
            expect(result).toEqual(mockResult);
        }));
    });
});
