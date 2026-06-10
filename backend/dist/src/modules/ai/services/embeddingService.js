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
exports.embeddingService = void 0;
const genai_1 = require("@google/genai");
// converteste textul in vectori numerici pentru a putea fi cautat dupa inteles
// Funcție pentru inițializare lazy a clientului
let aiInstance = null;
const getAi = () => {
    if (!aiInstance)
        aiInstance = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return aiInstance;
};
exports.embeddingService = {
    /**
     * Generează vectori pentru un fragment de text.
    * Model default folosit de Google pt embeddings text: gemini-embedding-001
     */
    embed(text) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!text || text.trim() === '') {
                throw new Error('Text is required for embedding');
            }
            const preferredModel = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-001';
            const modelFallbacks = [
                preferredModel,
                'models/gemini-embedding-001',
                'models/gemini-embedding-2',
            ];
            let lastError = null;
            for (const model of modelFallbacks) {
                try {
                    const response = yield getAi().models.embedContent({
                        model,
                        contents: text,
                        config: {
                            outputDimensionality: 768,
                        },
                    });
                    // Returnam prima valoare a vectorilor (deoarece cerem continut pentru o singură intrare)
                    if (response && response.embeddings && response.embeddings.length > 0) {
                        const vector = response.embeddings[0].values;
                        if (vector)
                            return vector;
                    }
                    throw new Error('Nu s-a putut obține vectorul din răspunsul Gemini');
                }
                catch (error) {
                    lastError = error;
                    const message = (error === null || error === void 0 ? void 0 : error.message) || '';
                    const status = error === null || error === void 0 ? void 0 : error.status;
                    const isModelMissing = status === 404 || message.includes('is not found') || message.includes('NOT_FOUND');
                    if (!isModelMissing) {
                        console.error('Eroare detaliată Gemini Embedding:', error);
                        throw error;
                    }
                }
            }
            console.error('Eroare detaliată Gemini Embedding:', lastError);
            throw lastError;
        });
    }
};
