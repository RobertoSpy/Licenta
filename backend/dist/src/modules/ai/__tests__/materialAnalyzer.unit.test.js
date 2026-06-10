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
const materialAnalyzer_1 = require("../services/materialAnalyzer");
const prisma_1 = require("../../../lib/prisma");
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    })),
    Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY' }
}));
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        material: {
            findMany: jest.fn(),
        },
    },
}));
describe('materialAnalyzer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('analyzeMaterial', () => {
        it('ar trebui sa returneze rezultatul parsat din Gemini', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.material.findMany.mockResolvedValue([
                { internalCode: 'BCA_25' },
                { internalCode: 'CARAMIDA_30' }
            ]);
            const mockResponse = {
                text: JSON.stringify({
                    standardCode: 'BCA_25',
                    category: 'Zidărie',
                    subcategory: 'Pereți exteriori',
                    unit: 'mc',
                    uValue: 0.45,
                    pros: 'Izoleaza bine',
                    cons: 'Absoarbe apa',
                    description: 'Descriere test',
                    brand: 'Ytong',
                    genericAlternatives: ['Caramida']
                })
            };
            mockGenerateContent.mockResolvedValue(mockResponse);
            const result = yield materialAnalyzer_1.materialAnalyzer.analyzeMaterial('Ytong Forte 25', 500, 'http://test');
            expect(prisma_1.prisma.material.findMany).toHaveBeenCalled();
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
                model: 'gemini-2.5-flash',
                contents: expect.stringContaining('Ytong Forte 25'),
            }));
            expect(result).not.toBeNull();
            expect(result === null || result === void 0 ? void 0 : result.standardCode).toBe('BCA_25');
            expect(result === null || result === void 0 ? void 0 : result.brand).toBe('Ytong');
            expect(result === null || result === void 0 ? void 0 : result.uValue).toBe(0.45);
        }));
        it('ar trebui sa returneze null daca ai.models.generateContent returneaza text gol', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.material.findMany.mockResolvedValue([]);
            mockGenerateContent.mockResolvedValue({ text: null });
            const result = yield materialAnalyzer_1.materialAnalyzer.analyzeMaterial('Produs', 10, 'http://test');
            expect(result).toBeNull();
        }));
        it('ar trebui sa returneze null daca procesarea esueaza (catch error)', () => __awaiter(void 0, void 0, void 0, function* () {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            prisma_1.prisma.material.findMany.mockResolvedValue([]);
            mockGenerateContent.mockRejectedValue(new Error('AI failed'));
            const result = yield materialAnalyzer_1.materialAnalyzer.analyzeMaterial('Produs', 10, 'http://test');
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        }));
    });
});
