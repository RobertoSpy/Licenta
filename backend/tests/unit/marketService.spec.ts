import { marketService } from '../../src/modules/market/marketService';
import { marketRepository } from '../../src/modules/market/marketRepository';

// Mockuim repository-ul pentru a nu atinge baza de date
jest.mock('../../src/modules/market/marketRepository');

describe('Market Service (Intelligence Module)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('_generateForecast', () => {
    it('ar trebui sa extraga datele matematice corect, sa calculeze si sa intoarca anii 2027 si 2028', async () => {
      // Mock de date crescatoare (100, 110, 120) => trend de crestere
      (marketRepository.getLastNPoints as jest.Mock).mockResolvedValue([
        { year: 2026, month: 1, indexValue: 100, category: 'rezidential' },
        { year: 2026, month: 2, indexValue: 110, category: 'rezidential' },
        { year: 2026, month: 3, indexValue: 120, category: 'rezidential' }
      ]);
      
      // Mocam apelul catre API-ul Gemini pentru a mentine testul Unitar (fara internet)
      jest.spyOn(marketService as any, '_generateVerdictText').mockResolvedValue('Moment excelent de investitie conform datelor mock-uite.');

      const result = await marketService._generateForecast();

      // Verificam structura de baza
      expect(result.years.length).toBe(2);
      expect(result.years[0].year).toBe(2027);
      expect(result.years[1].year).toBe(2028);
      expect(result.verdict).toBe('Moment excelent de investitie conform datelor mock-uite.');
      
      // Cum valorile (100, 110, 120) urca cu slope = 10, predictia ar trebui sa fie mult mai mare
      expect(result.years[0].predictedIndex).toBeGreaterThan(120);
    });
  });
});
