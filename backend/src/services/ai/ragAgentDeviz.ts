import { embeddingService } from './embeddingService';
import { normativeChunkRepository } from '../../repositories/normativeChunkRepository';

/**
 * Agent Deviz — caută în normative de cost și estimare financiară:
 * - P91-INCERC (Ghid de prețuri și evaluare costuri de construcție)
 */
export const ragAgentDeviz = {
  async search(question: string, limit: number = 3): Promise<string> {
    try {
      const vectorArray = await embeddingService.embed(question);
      const vectorStr = `[${vectorArray.join(',')}]`;
      const results = await normativeChunkRepository.findSimilarByAgent(vectorStr, limit, 'deviz');

      if (!results || results.length === 0) {
        return 'Nu am găsit informații de deviz relevante în normativele indexate (P91-INCERC).';
      }

      let context = '=== Context Deviz și Estimare Costuri (P91-INCERC) ===\n';
      results.forEach((r: any) => {
        context += `\n[${r.source} | ${r.chapter}]\n${r.content}\n`;
      });
      return context;
    } catch (error) {
      console.error('[ragAgentDeviz] Eroare:', error);
      return '';
    }
  }
};
