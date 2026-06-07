import { buildChatPrompt, buildOffTopicRefusalStream } from '../services/chatPromptBuilder';
import { AgentType } from '../../../data/normative-registry';

describe('chatPromptBuilder', () => {
  describe('buildOffTopicRefusalStream', () => {
    it('ar trebui sa returneze un async generator cu mesaje de refuz clare', async () => {
      const stream = buildOffTopicRefusalStream();
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk.text);
      }
      
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toContain('nu pare legată de construcția');
      expect(chunks[1]).toContain('Sunt specializat');
      expect(chunks[2]).toContain('Ce te interesează');
    });
  });

  describe('buildChatPrompt', () => {
    const baseInput = {
      userQuestion: 'Cat ciment imi trebuie?',
      contextString: 'Context proiect',
      activeAgents: ['structural'] as AgentType[],
      statusDisclaimer: '[Disclaimer Test]',
      ragContext: 'Normative extrase RAG'
    };

    it('ar trebui sa injecteze corect screenContext pentru "screen1" (faza teren/wizard)', () => {
      const prompt = buildChatPrompt({ ...baseInput, screenContext: 'screen1' });
      expect(prompt).toContain('CONTEXT SPECIAL — FAZA 1: WIZARD & TEREN');
      expect(prompt).toContain('Maximum tehnic etaje');
      expect(prompt).not.toContain('CONTEXT SPECIAL — FAZA 3');
    });

    it('ar trebui sa injecteze corect screenContext pentru "editor"', () => {
      const prompt = buildChatPrompt({ ...baseInput, screenContext: 'editor' });
      expect(prompt).toContain('CONTEXT SPECIAL — FAZA 2: EDITOR 2D');
      expect(prompt).toContain('cum să deseneze corect o casă');
    });

    it('ar trebui sa injecteze corect screenContext pentru "bom"', () => {
      const prompt = buildChatPrompt({ ...baseInput, screenContext: 'bom' });
      expect(prompt).toContain('CONTEXT SPECIAL — FAZA 3: DEVIZ & MATERIALE');
    });

    it('ar trebui sa injecteze corect screenContext pentru "energy"', () => {
      const prompt = buildChatPrompt({ ...baseInput, screenContext: 'energy' });
      expect(prompt).toContain('CONTEXT SPECIAL — EFICIENȚĂ ENERGETICĂ');
    });

    it('ar trebui sa injecteze corect screenContext pentru "market"', () => {
      const prompt = buildChatPrompt({ ...baseInput, screenContext: 'market' });
      expect(prompt).toContain('CONTEXT SPECIAL — ANALIZĂ PIAȚĂ CONSTRUCȚII');
      expect(prompt).toContain('INSSE CNS107D');
    });

    it('ar trebui sa returneze un prompt fara screen context special daca screen este necunoscut', () => {
      const prompt = buildChatPrompt({ ...baseInput, screenContext: 'unknown' });
      expect(prompt).not.toContain('CONTEXT SPECIAL PENTRU ECRAN');
    });

    it('ar trebui sa includa istoricul conversatiei daca este furnizat', () => {
      const history = [
        { role: 'user', text: 'Salut' },
        { role: 'model', text: 'Buna!' }
      ];
      const prompt = buildChatPrompt({ ...baseInput, conversationHistory: history });
      expect(prompt).toContain('ISTORIC CONVERSAȚIE:');
      expect(prompt).toContain('[Utilizator]: Salut');
      expect(prompt).toContain('[Zidario]: Buna!');
    });

    it('ar trebui sa includa summary-ul din istoricul lung daca este furnizat', () => {
      const prompt = buildChatPrompt({ ...baseInput, historySummary: 'Rezumat conversatie anterioara' });
      expect(prompt).toContain('=== CONTEXT PROIECT (din conversații anterioare) ===');
      expect(prompt).toContain('Rezumat conversatie anterioara');
    });

    it('ar trebui sa asigure existenta textelor de reglementare RAG in prompt', () => {
      const prompt = buildChatPrompt(baseInput);
      expect(prompt).toContain('REGLEMENTĂRI RELEVANTE DIN NORMATIVE (RAG — Hybrid Search):');
      expect(prompt).toContain('Normative extrase RAG');
    });

    it('ar trebui sa includa intrebarea finala a utilizatorului in prompt', () => {
      const prompt = buildChatPrompt(baseInput);
      expect(prompt).toContain('ÎNTREBARE UTILIZATOR:');
      expect(prompt).toContain('Cat ciment imi trebuie?');
    });
  });
});
