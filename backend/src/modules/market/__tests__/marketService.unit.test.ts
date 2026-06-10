import { marketService } from '../marketService';
import { marketRepository } from '../marketRepository';
import { GoogleGenAI } from '@google/genai';

jest.mock('../marketRepository');
jest.mock('@google/genai');

describe('Market Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getIndexHistory', () => {
    it('returns formatted and sorted history points', async () => {
      (marketRepository.getAll as jest.Mock).mockResolvedValue([
        { year: 2026, month: 2, category: 'rezidential', indexValue: 120 },
        { year: 2026, month: 1, category: 'rezidential', indexValue: 110 },
        { year: 2026, month: 1, category: 'total_cladiri', indexValue: 115 }
      ]);

      const res = await marketService.getIndexHistory();
      
      expect(res.length).toBe(2);
      expect(res[0].year).toBe(2026);
      expect(res[0].month).toBe(1);
      expect((res[0] as any).rezidential).toBe(110);
      expect((res[0] as any).total_cladiri).toBe(115);
      
      expect(res[1].year).toBe(2026);
      expect(res[1].month).toBe(2);
      expect((res[1] as any).rezidential).toBe(120);
    });
  });

  describe('getForecast', () => {
    const NOW = new Date('2026-06-07T00:00:00Z').getTime();
    
    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
    });
    
    afterAll(() => {
      jest.useRealTimers();
    });

    it('returns cached forecast if TTL is not expired (< 30 days)', async () => {
      const generatedAt = new Date(NOW - 29 * 24 * 60 * 60 * 1000).toISOString(); // 29 days ago
      (marketRepository.getLatestForecast as jest.Mock).mockResolvedValue({
        generatedAt,
        forecastJson: JSON.stringify({ years: [] })
      });

      const res = await marketService.getForecast();
      expect(res).toEqual({ years: [] });
      expect(marketRepository.upsertForecast).not.toHaveBeenCalled();
    });

    it('generates new forecast if cache is exactly TTL boundary (30 days ago)', async () => {
      const generatedAt = new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString(); // exactly 30 days ago
      (marketRepository.getLatestForecast as jest.Mock).mockResolvedValue({
        generatedAt,
        forecastJson: JSON.stringify({ years: [{ year: 2027 }] })
      });
      
      // Mocks for generation
      (marketRepository.getLastNPoints as jest.Mock).mockResolvedValue([
        { year: 2026, month: 1, indexValue: 100 },
        { year: 2026, month: 2, indexValue: 110 }
      ]);
      (GoogleGenAI.prototype.models as any) = { generateContent: jest.fn().mockRejectedValue(new Error('no ai')) };

      await marketService.getForecast();
      
      // It should call upsertForecast
      expect(marketRepository.upsertForecast).toHaveBeenCalled();
    });

    it('regenerates forecast if JSON is malformed (corrupt cache)', async () => {
      const generatedAt = new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago (valid TTL)
      (marketRepository.getLatestForecast as jest.Mock).mockResolvedValue({
        generatedAt,
        forecastJson: '{ malformed json'
      });
      
      (marketRepository.getLastNPoints as jest.Mock).mockResolvedValue([
        { year: 2026, month: 1, indexValue: 100 },
        { year: 2026, month: 2, indexValue: 110 }
      ]);

      await marketService.getForecast();
      
      expect(marketRepository.upsertForecast).toHaveBeenCalled();
    });
  });

  describe('_generateVerdictText', () => {
    it('returns fallback text when Gemini throws network error', async () => {
      (GoogleGenAI.prototype.models as any) = { generateContent: jest.fn().mockRejectedValue(new Error('Network error')) };
      
      const res = await marketService._generateVerdictText([], 100, { inflationYoY: 10, materialeBase2021: 42 });
      
      expect(res).toContain('Momentul este moderat');
      expect(res).not.toContain('undefined');
    });

    it('returns fallback text when Gemini returns empty response', async () => {
      (GoogleGenAI.prototype.models as any) = { generateContent: jest.fn().mockResolvedValue({ text: '' }) };
      
      const res = await marketService._generateVerdictText([], 100, { inflationYoY: 10, materialeBase2021: 42 });
      
      expect(res).toContain('Momentul este moderat');
    });

    it('returns successful Gemini response as-is', async () => {
      const aiResponse = 'Acesta este un verdict AI clar.';
      (GoogleGenAI.prototype.models as any) = { generateContent: jest.fn().mockResolvedValue({ text: aiResponse }) };
      
      const res = await marketService._generateVerdictText([], 100, { inflationYoY: 10, materialeBase2021: 42 });
      
      expect(res).toBe(aiResponse);
    });
  });

  describe('getSummary Context String', () => {
    it('formats context string correctly for RAG agent without undefined placeholders', async () => {
      (marketRepository.getByCategory as jest.Mock).mockResolvedValue([
        { year: 2025, month: 1, indexValue: 100 },
        { year: 2026, month: 1, indexValue: 110 } // +10% YoY
      ]);
      
      // Mock getForecast to avoid full generation logic
      jest.spyOn(marketService, 'getForecast').mockResolvedValue({
        generatedAt: '2026-06-07',
        verdict: 'Totul e OK',
        verdictLevel: 'bun',
        methodology: 'test',
        years: [{ year: 2027, predictedIndex: 120, lowerBound: 110, upperBound: 130, yoyChangePercent: 9.1 }]
      });

      const summary = await marketService.getSummary();
      
      expect(summary.contextString).toContain('110'); // current index
      expect(summary.contextString).toContain('+10%'); // yoy
      expect(summary.contextString).not.toContain('undefined');
      expect(summary.contextString).toContain('VERDICT CURENT: Totul e OK');
      expect(summary.contextString).toContain('2027: indice estimat 120');
    });
  });
  describe('Manual Context Validation', () => {
    it('manual-market-context.json should exist and have valid values', () => {
      const manualContext = require('../../../data/manual-market-context.json');
      
      expect(manualContext).toBeDefined();
      expect(manualContext.laborIndexVsBase2021).toBeGreaterThan(0);
      expect(manualContext.energyIndexVsBase2021).toBeGreaterThan(0);
      expect(manualContext._source).toBeDefined();
    });
  });
});
