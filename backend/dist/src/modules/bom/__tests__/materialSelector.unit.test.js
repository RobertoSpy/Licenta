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
const materialSelector_1 = require("../materialSelector");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        material: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));
describe('materialSelector', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('STRICT_NORMATIVE', () => {
        it('ar trebui sa returneze materialul exact cerut de motor (engineSuggestedCode)', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMaterial = { internalCode: 'MAT-123', name: 'Beton C25/30' };
            prisma_1.prisma.material.findUnique.mockResolvedValue(mockMaterial);
            const query = { type: 'STRICT_NORMATIVE', engineKey: 'beton_structura' };
            const result = yield (0, materialSelector_1.selectMaterialForBOM)(query, 'economic', 'MAT-123');
            expect(prisma_1.prisma.material.findUnique).toHaveBeenCalledWith({
                where: { internalCode: 'MAT-123' },
            });
            expect(result).toEqual(mockMaterial);
        }));
        it('ar trebui sa arunce eroare daca engineSuggestedCode lipseste', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = { type: 'STRICT_NORMATIVE', engineKey: 'beton_structura' };
            yield expect((0, materialSelector_1.selectMaterialForBOM)(query, 'economic')).rejects.toThrow('Lipsă engineSuggestedCode pentru beton_structura');
        }));
    });
    describe('NORMATIVE_BUDGET', () => {
        it('ar trebui sa aplice constrangerile normative de baza (U-value, rezistenta, seism)', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMaterials = [{ internalCode: 'MAT-A' }, { internalCode: 'MAT-B' }];
            prisma_1.prisma.material.findMany.mockResolvedValue(mockMaterials);
            const query = {
                type: 'NORMATIVE_BUDGET',
                category: 'zidarie',
                constraints: {
                    maxUValue: 0.3,
                    minStrength: 10,
                },
            };
            yield (0, materialSelector_1.selectMaterialForBOM)(query, 'economic', undefined, 0.25);
            expect(prisma_1.prisma.material.findMany).toHaveBeenCalledWith({
                where: {
                    category: 'zidarie',
                    inStock: true,
                    uValue: { lte: 0.3 },
                    compressiveStrength: { gte: 10 },
                    OR: [
                        { minSeismicZone: { lte: 0.25 } },
                        { minSeismicZone: null },
                    ],
                },
                orderBy: { pricePerUnit: 'asc' },
            });
        }));
        it('ar trebui sa aleaga optiunea mediana pentru buget "mediu"', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMaterials = [
                { internalCode: 'MAT-1', pricePerUnit: 10 },
                { internalCode: 'MAT-2', pricePerUnit: 20 },
                { internalCode: 'MAT-3', pricePerUnit: 30 },
            ];
            prisma_1.prisma.material.findMany.mockResolvedValue(mockMaterials);
            const query = { type: 'NORMATIVE_BUDGET', category: 'zidarie' };
            const result = yield (0, materialSelector_1.selectMaterialForBOM)(query, 'mediu');
            // 3 elements -> median is index 1 (MAT-2)
            expect(result).toEqual(mockMaterials[1]);
        }));
    });
    describe('FREE_PREFERENCE', () => {
        it('ar trebui sa nu aplice constrangeri suplimentare pentru FREE_PREFERENCE', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMaterials = [{ internalCode: 'MAT-1' }];
            prisma_1.prisma.material.findMany.mockResolvedValue(mockMaterials);
            const query = { type: 'FREE_PREFERENCE', category: 'finisaje' };
            yield (0, materialSelector_1.selectMaterialForBOM)(query, 'economic');
            expect(prisma_1.prisma.material.findMany).toHaveBeenCalledWith({
                where: {
                    category: 'finisaje',
                    inStock: true,
                },
                orderBy: { pricePerUnit: 'asc' },
            });
        }));
        it('ar trebui sa returneze null daca nu gaseste materiale', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.material.findMany.mockResolvedValue([]);
            const query = { type: 'FREE_PREFERENCE', category: 'finisaje' };
            const result = yield (0, materialSelector_1.selectMaterialForBOM)(query, 'economic');
            expect(result).toBeNull();
        }));
    });
});
