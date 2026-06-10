"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RETRIES_PER_MODEL = exports.FALLBACK_MODELS_JSON = exports.FALLBACK_MODELS_CHAT = exports.getAi = void 0;
const genai_1 = require("@google/genai");
let aiInstance = null;
const getAi = () => {
    if (!aiInstance)
        aiInstance = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return aiInstance;
};
exports.getAi = getAi;
exports.FALLBACK_MODELS_CHAT = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
exports.FALLBACK_MODELS_JSON = ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
exports.MAX_RETRIES_PER_MODEL = 2;
