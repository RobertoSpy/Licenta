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
const materialRepository_1 = require("../materialRepository");
const setup_1 = require("../../../../tests/setup");
describe('Material Repository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('findAll', () => {
        it('returns all materials from prisma', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMaterials = [
                { id: 1, internalCode: 'MAT-1', name: 'Material 1', pricePerUnit: 100 },
            ];
            setup_1.prismaMock.material.findMany.mockResolvedValue(mockMaterials);
            const result = yield materialRepository_1.materialRepository.findAll();
            expect(setup_1.prismaMock.material.findMany).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockMaterials);
        }));
    });
    describe('findByInternalCodeWithAlternatives', () => {
        it('findByInternalCodeWithAlternatives returns null for unknown code', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.material.findUnique.mockResolvedValue(null);
            const result = yield materialRepository_1.materialRepository.findByInternalCodeWithAlternatives('UNKNOWN');
            expect(setup_1.prismaMock.material.findUnique).toHaveBeenCalledWith({
                where: { internalCode: 'UNKNOWN' },
                include: { alternatives: true },
            });
            expect(result).toBeNull();
        }));
        it('findByInternalCodeWithAlternatives returns material with alternatives array', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMaterial = {
                id: 1,
                internalCode: 'MAT-1',
                alternatives: [{ id: 2, internalCode: 'MAT-2' }],
            };
            setup_1.prismaMock.material.findUnique.mockResolvedValue(mockMaterial);
            const result = yield materialRepository_1.materialRepository.findByInternalCodeWithAlternatives('MAT-1');
            expect(result).toEqual(mockMaterial);
            expect(result === null || result === void 0 ? void 0 : result.alternatives).toHaveLength(1);
        }));
        it('findByInternalCodeWithAlternatives returns material with empty alternatives array when none exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockMaterial = {
                id: 1,
                internalCode: 'MAT-1',
                alternatives: [],
            };
            setup_1.prismaMock.material.findUnique.mockResolvedValue(mockMaterial);
            const result = yield materialRepository_1.materialRepository.findByInternalCodeWithAlternatives('MAT-1');
            expect(result).toEqual(mockMaterial);
            expect(result === null || result === void 0 ? void 0 : result.alternatives).toEqual([]);
        }));
    });
});
