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
const constructionRepository_1 = require("../constructionRepository");
const prisma_1 = require("../../../lib/prisma");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        constructionPhase: {
            findMany: jest.fn(),
            createMany: jest.fn(),
            deleteMany: jest.fn(),
            update: jest.fn(),
        }
    }
}));
const prismaMock = prisma_1.prisma;
describe('ConstructionRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getByProject', () => {
        it('returns phases ordered by phaseOrder', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockPhases = [{ id: 1, phaseOrder: 1 }, { id: 2, phaseOrder: 2 }];
            prismaMock.constructionPhase.findMany.mockResolvedValue(mockPhases);
            const result = yield constructionRepository_1.constructionRepository.getByProject(10);
            expect(prismaMock.constructionPhase.findMany).toHaveBeenCalledWith({
                where: { projectId: 10 },
                orderBy: { phaseOrder: 'asc' }
            });
            expect(result).toEqual(mockPhases);
        }));
    });
    describe('createMany', () => {
        it('calls createMany with provided data', () => __awaiter(void 0, void 0, void 0, function* () {
            const data = [{ projectId: 1, name: 'Phase 1' }];
            prismaMock.constructionPhase.createMany.mockResolvedValue({ count: 1 });
            yield constructionRepository_1.constructionRepository.createMany(data);
            expect(prismaMock.constructionPhase.createMany).toHaveBeenCalledWith({
                data
            });
        }));
    });
    describe('deleteByProject', () => {
        it('deletes phases for given project', () => __awaiter(void 0, void 0, void 0, function* () {
            prismaMock.constructionPhase.deleteMany.mockResolvedValue({ count: 5 });
            yield constructionRepository_1.constructionRepository.deleteByProject(10);
            expect(prismaMock.constructionPhase.deleteMany).toHaveBeenCalledWith({
                where: { projectId: 10 }
            });
        }));
    });
    describe('markPhaseCompleted', () => {
        it('updates phase with composite key', () => __awaiter(void 0, void 0, void 0, function* () {
            const updatedPhase = { id: 1, isCompleted: true };
            prismaMock.constructionPhase.update.mockResolvedValue(updatedPhase);
            const result = yield constructionRepository_1.constructionRepository.markPhaseCompleted(10, 2);
            expect(prismaMock.constructionPhase.update).toHaveBeenCalledWith({
                where: {
                    projectId_phaseOrder: {
                        projectId: 10,
                        phaseOrder: 2
                    }
                },
                data: {
                    isCompleted: true,
                    completedAt: expect.any(Date)
                }
            });
            expect(result).toEqual(updatedPhase);
        }));
        it('throws if composite key does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            prismaMock.constructionPhase.update.mockRejectedValue(new Error('Record not found'));
            yield expect(constructionRepository_1.constructionRepository.markPhaseCompleted(10, 99)).rejects.toThrow('Record not found');
        }));
    });
});
