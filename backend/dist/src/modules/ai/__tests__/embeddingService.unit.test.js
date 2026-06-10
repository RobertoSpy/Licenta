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
const embeddingService_1 = require("../services/embeddingService");
const mockEmbedContent = jest.fn();
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            embedContent: mockEmbedContent,
        },
    })),
}));
describe('embeddingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('embed', () => {
        it('ar trebui sa arunce o eroare daca textul este gol', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(embeddingService_1.embeddingService.embed('')).rejects.toThrow('Text is required for embedding');
            yield expect(embeddingService_1.embeddingService.embed('   ')).rejects.toThrow('Text is required for embedding');
        }));
        it('ar trebui sa returneze vectorii de la primul apel reusit', () => __awaiter(void 0, void 0, void 0, function* () {
            mockEmbedContent.mockResolvedValueOnce({
                embeddings: [{ values: [0.1, 0.2, 0.3] }]
            });
            const result = yield embeddingService_1.embeddingService.embed('Text de test');
            expect(mockEmbedContent).toHaveBeenCalledTimes(1);
            expect(result).toEqual([0.1, 0.2, 0.3]);
        }));
        it('ar trebui sa faca fallback la alt model daca primul nu este gasit (404)', () => __awaiter(void 0, void 0, void 0, function* () {
            const error404 = new Error('Model not found');
            error404.status = 404;
            mockEmbedContent
                .mockRejectedValueOnce(error404) // primul model fail
                .mockResolvedValueOnce({
                embeddings: [{ values: [0.4, 0.5, 0.6] }] // al doilea model success
            });
            const result = yield embeddingService_1.embeddingService.embed('Fallback text');
            expect(mockEmbedContent).toHaveBeenCalledTimes(2);
            expect(result).toEqual([0.4, 0.5, 0.6]);
        }));
        it('ar trebui sa arunce eroare imediat daca eroarea nu este 404', () => __awaiter(void 0, void 0, void 0, function* () {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const error500 = new Error('Internal Server Error');
            error500.status = 500;
            mockEmbedContent.mockRejectedValueOnce(error500);
            yield expect(embeddingService_1.embeddingService.embed('Eroare 500')).rejects.toThrow('Internal Server Error');
            expect(mockEmbedContent).toHaveBeenCalledTimes(1); // nu face fallback
            consoleSpy.mockRestore();
        }));
        it('ar trebui sa arunce eroare daca toate modelele de fallback esueaza cu 404', () => __awaiter(void 0, void 0, void 0, function* () {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const error404 = new Error('Model is not found');
            error404.status = 404;
            // Sunt 3 optiuni de model in cod
            mockEmbedContent
                .mockRejectedValueOnce(error404)
                .mockRejectedValueOnce(error404)
                .mockRejectedValueOnce(error404);
            yield expect(embeddingService_1.embeddingService.embed('Toate esueaza')).rejects.toThrow('Model is not found');
            expect(mockEmbedContent).toHaveBeenCalledTimes(3);
            consoleSpy.mockRestore();
        }));
    });
});
