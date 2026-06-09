import { buildRoomProgramPrompt, validateRoomSuggestion } from '../services/roomProgramPrompt';
import type { SuggestRoomsInput, RoomSuggestion } from '../../../core/types/roomSuggestion';

// Mock the conformity rules to isolate the test from the actual json file
jest.mock('../../../data/conformity-rules.json', () => ({
  room_min_sqm: [
    { targets: ['dormitor'], min_sqm: 12 },
    { targets: ['baie'], min_sqm: 4.5 }
  ]
}));

describe('roomProgramPrompt', () => {
  describe('buildRoomProgramPrompt', () => {
    const baseInput: SuggestRoomsInput = {
      houseAreaSqm: 100,
      plotAreaSqm: 500,
      houseStyle: 'Modern',
      totalFloors: 2,
      hasBasement: false,
      streetOrientation: 'S',
      familySize: 4,
      budgetCategory: 'mediu',
      buildingPurpose: 'residential'
    };

    it('ar trebui sa includa structura corecta a etajelor (fara subsol, parter + etaj1)', () => {
      const prompt = buildRoomProgramPrompt({ input: baseInput, ragContext: 'Context', targetArea: 100 });
      expect(prompt).toContain('- Structura: parter + etaj1');
    });

    it('ar trebui sa includa structura corecta a etajelor (cu subsol, parter + etaj1 + etaj2)', () => {
      const input = { ...baseInput, hasBasement: true, totalFloors: 3 };
      const prompt = buildRoomProgramPrompt({ input, ragContext: 'Context', targetArea: 100 });
      expect(prompt).toContain('- Structura: subsol + parter + etaj1 + etaj2');
    });

    it('ar trebui sa includa reguli specifice pentru buget economic', () => {
      const input = { ...baseInput, budgetCategory: 'economic' as const };
      const prompt = buildRoomProgramPrompt({ input, ragContext: 'Context', targetArea: 100 });
      expect(prompt).toContain('EXTREM DE EFICIENTE');
      expect(prompt).not.toContain('luxul și spațiul');
    });

    it('ar trebui sa includa reguli specifice pentru buget premium', () => {
      const input = { ...baseInput, budgetCategory: 'premium' as any };
      const prompt = buildRoomProgramPrompt({ input, ragContext: 'Context', targetArea: 100 });
      expect(prompt).toContain('Maximizează luxul și spațiul');
      expect(prompt).not.toContain('EXTREM DE EFICIENTE');
    });

    it('ar trebui sa mandateze output in JSON si suprafata construita obligatorie', () => {
      const prompt = buildRoomProgramPrompt({ input: baseInput, ragContext: 'Context RAG', targetArea: 150 });
      expect(prompt).toContain('Suprafață construită totală: 150 mp (OBLIGATORIU respectat)');
      expect(prompt).toContain('RĂSPUNDE DOAR CU JSON');
      expect(prompt).toContain('Context RAG');
    });
  });

  describe('validateRoomSuggestion', () => {
    it('ar trebui sa arunce eroare daca lipsesc camerele', () => {
      const parsed = { totalEstimatedSqm: 100 } as any;
      expect(() => validateRoomSuggestion(parsed, 100)).toThrow('JSON invalid: câmpul "rooms" lipsește sau e gol.');
    });

    it('ar trebui sa arunce eroare daca suprafata estimata e prea mica', () => {
      const parsed: RoomSuggestion = {
        totalEstimatedSqm: 50, // sub 75% din 100
        rooms: [{ type: 'hol', label: 'Hol', weightRatio: 1, zone: 'distributie', floor: 'parter', isCirculation: true, hasStaircase: false, minSqm: 10, maxSqm: 12, mustAdjacentTo: [], hasDoorTo: [], naturalLight: false, orientation: [], reasoning: '' }],
        layoutAdvice: '',
        normativeNote: ''
      };
      expect(() => validateRoomSuggestion(parsed, 100)).toThrow('Validare eșuată: AI a generat doar 50mp din 100mp ceruți.');
    });

    it('ar trebui sa forteze suprafețele minime din conformity rules daca sunt sub limita legala', () => {
      const parsed: RoomSuggestion = {
        totalEstimatedSqm: 90,
        rooms: [
          { type: 'dormitor', label: 'Dormitor Mic', weightRatio: 1, zone: 'noapte', floor: 'parter', isCirculation: false, hasStaircase: false, minSqm: 8, maxSqm: 12, mustAdjacentTo: [], hasDoorTo: [], naturalLight: true, orientation: [], reasoning: '' },
          { type: 'baie', label: 'Baie', weightRatio: 1, zone: 'tehnic', floor: 'parter', isCirculation: false, hasStaircase: false, minSqm: 3, maxSqm: 5, mustAdjacentTo: [], hasDoorTo: [], naturalLight: false, orientation: [], reasoning: '' }
        ],
        layoutAdvice: '',
        normativeNote: ''
      };

      const validated = validateRoomSuggestion(parsed, 100);
      
      // Conformity rules mocked: dormitor = 12, baie = 4.5
      expect(validated.rooms[0].minSqm).toBe(12);
      expect(validated.rooms[1].minSqm).toBe(4.5);
    });

    it('nu ar trebui sa modifice minSqm daca AI a setat o valoare conforma legii', () => {
      const parsed: RoomSuggestion = {
        totalEstimatedSqm: 90,
        rooms: [
          { type: 'dormitor', label: 'Dormitor Matrimonial', weightRatio: 1, zone: 'noapte', floor: 'parter', isCirculation: false, hasStaircase: false, minSqm: 16, maxSqm: 20, mustAdjacentTo: [], hasDoorTo: [], naturalLight: true, orientation: [], reasoning: '' }
        ],
        layoutAdvice: '',
        normativeNote: ''
      };

      const validated = validateRoomSuggestion(parsed, 100);
      expect(validated.rooms[0].minSqm).toBe(16); // Pastreaza 16, nu il scade la 12
    });
  });
});
