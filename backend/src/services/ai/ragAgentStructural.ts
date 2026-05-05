import { embeddingService } from './embeddingService';
import { normativeChunkRepository } from '../../repositories/normativeChunkRepository';

/**
 * Agent Structural — caută în documente privind rezistența și stabilitatea structurală:
 * - CR6-2013  (Cod de proiectare pentru structuri din zidărie)
 * - CR1-1-3-2012 (Evaluarea acțiunii zăpezii)
 * - CR1-1-4-2012 (Evaluarea acțiunii vântului)
 * - NE012-1-2022 (Normativ beton — execuție și control)
 * - C56-2002  (Verificarea calității lucrărilor de construcții)
 */
export const ragAgentStructural = {
  async search(question: string, limit: number = 3): Promise<string> {
    try {
      const vectorArray = await embeddingService.embed(question);
      const vectorStr = `[${vectorArray.join(',')}]`;
      const results = await normativeChunkRepository.findSimilarByAgent(vectorStr, limit, 'structural');

      if (!results || results.length === 0) {
        return 'Nu am găsit informații structurale relevante în normativele indexate (CR6-2013, CR1-1-3, CR1-1-4, NE012, C56).';
      }

      let context = '=== Context Structural (CR6-2013, CR1-1-3/4-2012, NE012-1-2022, C56-2002) ===\n';
      results.forEach((r: any) => {
        const disclaimer = r.source === 'P100-1-2013'
          ? '\n[⚠️ Notă: P100-1/2025 este în stadiu de redactare și nu a intrat în vigoare.]\n'
          : '';
        context += `\n[${r.source} | ${r.chapter}]${disclaimer}\n${r.content}\n`;
      });
      return context;
    } catch (error) {
      console.error('[ragAgentStructural] Eroare:', error);
      return '';
    }
  }
};
