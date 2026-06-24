import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

export const FALLBACK_MODELS_CHAT = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
export const FALLBACK_MODELS_JSON = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
export const MAX_RETRIES_PER_MODEL = 2;
