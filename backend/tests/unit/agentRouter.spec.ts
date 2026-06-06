import { detectRequiredAgents, isOffTopic } from '../../src/modules/ai/services/agentRouter';

describe('AI Agent Router Module', () => {
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

  describe('detectRequiredAgents', () => {
    it('ar trebui sa returneze [geotehnic] cand se pune o intrebare despre pamant/sol', async () => {
      const agents = await detectRequiredAgents('Cat trebuie sa sap in argila?', 'screen1');
      expect(agents).toContain('geotehnic');
    });

    it('ar trebui sa aplice fallback bazat pe screen daca nicio categorie nu e direct gasita', async () => {
      const agents = await detectRequiredAgents('Vreau să fac ceva frumos', 'screen4');
      expect(agents).toEqual(expect.arrayContaining(['legal', 'architectural']));
    });

    it('ar trebui sa forteze financial cand ne aflam pe ecranul market', async () => {
      const agents = await detectRequiredAgents('Mă gândesc să încep', 'market');
      expect(agents).toContain('financial');
    });

    it('ar trebui sa asigure fallback [legal] daca ecranul nu exista si nici regexul nu prinde', async () => {
      const agents = await detectRequiredAgents('Buna', 'unknown_screen');
      expect(agents).toContain('legal');
    });

    it('ar trebui sa introduca asistentul "deviz" si "materiale" cand se pune o intrebare legata de costuri', async () => {
      const agents = await detectRequiredAgents('cat ma costa fierul pentru stalp?', 'screen3');
      expect(agents).toContain('deviz');
      expect(agents).toContain('materiale');
      expect(agents).toContain('structural'); // fiindca scrie "stalp" si "fier"
    });
  });
});
