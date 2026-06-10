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
const bomRepository_1 = require("../bomRepository");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        projectBOM: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));
describe('BOMRepository', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('deleteByProject', () => {
        it('ar trebui sa stearga toate intrarile BOM pentru un proiect', () => __awaiter(void 0, void 0, void 0, function* () {
            yield bomRepository_1.bomRepository.deleteByProject(1);
            expect(prisma_1.prisma.projectBOM.deleteMany).toHaveBeenCalledWith({ where: { projectId: 1 } });
        }));
    });
    describe('createMany', () => {
        it('ar trebui sa creeze inregistrari multiple BOM', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockItems = [{ projectId: 1, materialId: 10, quantity: 5, phase: 'fundatie' }];
            yield bomRepository_1.bomRepository.createMany(mockItems);
            expect(prisma_1.prisma.projectBOM.createMany).toHaveBeenCalledWith({ data: mockItems });
        }));
    });
    describe('findByProject', () => {
        it('ar trebui sa returneze toate intrarile BOM cu detalii material pentru un proiect', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResult = [{ id: 1, phase: 'structura', material: { name: 'Beton' } }];
            prisma_1.prisma.projectBOM.findMany.mockResolvedValue(mockResult);
            const result = yield bomRepository_1.bomRepository.findByProject(1);
            expect(prisma_1.prisma.projectBOM.findMany).toHaveBeenCalledWith({
                where: { projectId: 1 },
                include: { material: true },
                orderBy: { phase: 'asc' },
            });
            expect(result).toEqual(mockResult);
        }));
    });
});
