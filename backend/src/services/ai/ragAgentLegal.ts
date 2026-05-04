import { embeddingService } from './embeddingService';
import { normativeChunkRepository } from '../../repositories/normativeChunkRepository';

/**
 * Agent Legal — caută exclusiv în documente legislative și de urbanism:
 * - Legea 50/1991 (Autorizarea lucrărilor de construcții)
 * - Legea 350/2001 (Urbanismul și amenajarea teritoriului)
 */
export const ragAgentLegal = {
  async search(question: string, limit: number = 3): Promise<string> {
    try {
      const vectorArray = await embeddingService.embed(question);
      const vectorStr = `[${vectorArray.join(',')}]`;
      const results = await normativeChunkRepository.findSimilarByAgent(vectorStr, limit, 'legal');

      if (!results || results.length === 0) {
        return 'Nu am găsit informații legislative relevante în normativele indexate (Legea 50/1991, Legea 350/2001).';
      }

      let context = '=== Context Legal (Legea 50/1991, Legea 350/2001) ===\n';
      results.forEach((r: any) => {
        context += `\n[${r.source} | ${r.chapter}]\n${r.content}\n`;
      });
      return context;
    } catch (error) {
      console.error('[ragAgentLegal] Eroare:', error);
      return '';
    }
  }
};
