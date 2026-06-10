"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aiClient_1 = require("../services/aiClient");
const genai_1 = require("@google/genai");
jest.mock('@google/genai', () => {
    return {
        GoogleGenAI: jest.fn().mockImplementation(() => ({
            _isMock: true
        }))
    };
});
describe('aiClient', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = Object.assign({}, originalEnv);
    });
    afterAll(() => {
        process.env = originalEnv;
    });
    it('ar trebui sa initializeze o singura instanta de GoogleGenAI (singleton)', () => {
        process.env.GEMINI_API_KEY = 'test_api_key';
        const ai1 = (0, aiClient_1.getAi)();
        const ai2 = (0, aiClient_1.getAi)();
        expect(genai_1.GoogleGenAI).toHaveBeenCalledTimes(1);
        expect(genai_1.GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test_api_key' });
        expect(ai1).toBe(ai2);
        expect(ai1._isMock).toBe(true);
    });
    it('ar trebui sa expuna constantele configurate pentru modele de fallback', () => {
        expect(Array.isArray(aiClient_1.FALLBACK_MODELS_CHAT)).toBe(true);
        expect(aiClient_1.FALLBACK_MODELS_CHAT.length).toBeGreaterThan(0);
        expect(aiClient_1.FALLBACK_MODELS_CHAT).toContain('gemini-2.5-flash');
        expect(Array.isArray(aiClient_1.FALLBACK_MODELS_JSON)).toBe(true);
        expect(aiClient_1.FALLBACK_MODELS_JSON.length).toBeGreaterThan(0);
        expect(aiClient_1.FALLBACK_MODELS_JSON).toContain('gemini-2.5-pro');
        expect(typeof aiClient_1.MAX_RETRIES_PER_MODEL).toBe('number');
        expect(aiClient_1.MAX_RETRIES_PER_MODEL).toBeGreaterThan(0);
    });
});
