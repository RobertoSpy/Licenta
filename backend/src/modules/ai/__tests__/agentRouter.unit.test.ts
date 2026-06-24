import { detectRequiredAgents, isOffTopic } from '../services/agentRouter';
import { embeddingService } from '../services/embeddingService';

jest.mock('../services/embeddingService', () => ({
  embeddingService: {
    embed: jest.fn()
  }
}));

describe('AI Agent Router Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (embeddingService.embed as jest.Mock).mockImplementation(async (text: string) => {
      // Agent descriptions
      if (text.includes('Informații despre sol')) return [1, 0, 0]; // geotehnic
      if (text.includes('Costuri, prețuri')) return [0, 1, 0]; // deviz
      
      // Test questions
      if (text === 'intrebare_sub_limita') return [0.5, 0.5, 0.5]; // ~0.57 similarity with both
      if (text === 'intrebare_peste_limita') return [0.65, 0, 0.76]; // matches geotehnic (0.65), doesn't match deviz (0)
      if (text === 'intrebare_multi_agenti') return [0.65, 0.65, 0.39]; // matches both
      
      return [0, 0, 0];
    });
  });

  describe('isOffTopic', () => {
    it('ar trebui sa returneze true pentru un subiect culinar (off-topic)', () => {
      expect(isOffTopic('Cum fac o rețetă de pizza?')).toBe(true);
    });

    it('ar trebui sa returneze false pentru un subiect de constructii', () => {
      expect(isOffTopic('Cum torn fundația la casa mea?')).toBe(false);
    });
    
    it('ar trebui sa returneze true pentru subiecte politice', () => {
      expect(isOffTopic('Cine iese președinte anul asta?')).toBe(true);
    });
  });

  describe('detectRequiredAgents - Regex Routing', () => {
    it('ar trebui sa returneze [geotehnic] cand se pune o intrebare despre pamant/sol', async () => {
      const agents = await detectRequiredAgents('Cat trebuie sa sap in pamant?', 'screen1');
      expect(agents).toContain('geotehnic');
    });

    it('ar trebui sa aplice fallback bazat pe screen daca nicio categorie nu e direct gasita si fara semantic', async () => {
      const agents = await detectRequiredAgents('Vreau să fac ceva neobisnuit', 'screen4');
      expect(agents).toEqual(expect.arrayContaining(['legal', 'architectural']));
    });

    it('ar trebui sa forteze financial cand ne aflam pe ecranul market', async () => {
      const agents = await detectRequiredAgents('Mă gândesc să încep', 'market');
      expect(agents).toContain('financial');
    });

    it('ar trebui sa asigure fallback [general] daca ecranul nu exista si nici regexul nu prinde', async () => {
      const agents = await detectRequiredAgents('Salut', 'unknown_screen');
      expect(agents).toContain('general');
    });

    it('ar trebui sa introduca asistentul "deviz" si "materiale" cand se pune o intrebare legata de costuri', async () => {
      const agents = await detectRequiredAgents('cat ma costa fierul pentru stalp?', 'screen3');
      expect(agents).toContain('deviz');
      expect(agents).toContain('materiale');
      expect(agents).toContain('structural');
    });
  });

  describe('detectRequiredAgents - Semantic Routing Thresholds', () => {
    it('ar trebui sa respinga agentul daca similaritatea cosinus este 0.592 (sub pragul de 0.60)', async () => {
      const agents = await detectRequiredAgents('intrebare_sub_limita', 'unknown_screen');
      expect(agents).not.toContain('geotehnic');
      expect(agents).toContain('general');
    });

    it('ar trebui sa admita agentul daca similaritatea cosinus este 0.649 (peste pragul de 0.60)', async () => {
      const agents = await detectRequiredAgents('intrebare_peste_limita', 'unknown_screen');
      expect(agents).toContain('geotehnic');
      expect(agents).not.toContain('legal'); // a gasit ceva, nu face fallback
    });

    it('ar trebui sa admita agentul dominant si pe cel secundar (amandoi > 0.60) cu includerea dependintelor (deviz -> materiale)', async () => {
      const agents = await detectRequiredAgents('intrebare_multi_agenti', 'unknown_screen');
      expect(agents).toContain('geotehnic');
      expect(agents).toContain('deviz');
      expect(agents).toContain('materiale');
    });
  });
});
