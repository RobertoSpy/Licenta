import { getAi, FALLBACK_MODELS_CHAT, FALLBACK_MODELS_JSON, MAX_RETRIES_PER_MODEL } from '../services/aiClient';
import { GoogleGenAI } from '@google/genai';

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
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('ar trebui sa initializeze o singura instanta de GoogleGenAI (singleton)', () => {
    process.env.GEMINI_API_KEY = 'test_api_key';

    const ai1 = getAi();
    const ai2 = getAi();

    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test_api_key' });
    expect(ai1).toBe(ai2);
    expect((ai1 as any)._isMock).toBe(true);
  });

  it('ar trebui sa expuna constantele configurate pentru modele de fallback', () => {
    expect(Array.isArray(FALLBACK_MODELS_CHAT)).toBe(true);
    expect(FALLBACK_MODELS_CHAT.length).toBeGreaterThan(0);
    expect(FALLBACK_MODELS_CHAT).toContain('gemini-2.5-flash');

    expect(Array.isArray(FALLBACK_MODELS_JSON)).toBe(true);
    expect(FALLBACK_MODELS_JSON.length).toBeGreaterThan(0);
    expect(FALLBACK_MODELS_JSON).toContain('gemini-2.5-pro');

    expect(typeof MAX_RETRIES_PER_MODEL).toBe('number');
    expect(MAX_RETRIES_PER_MODEL).toBeGreaterThan(0);
  });
});
