import { embeddingService } from './embeddingService';
import { normativeChunkRepository } from '../../repositories/normativeChunkRepository';

/**
 * Agent Seismic — caută exclusiv în documente despre seismicitate și structură:
 * - P100-1/2013 (Cod de proiectare seismică)
 */
export const ragAgentSeismic = {
  async search(question: string, limit: number = 3): Promise<string> {
    try {
      const vectorArray = await embeddingService.embed(question);
      const vectorStr = `[${vectorArray.join(',')}]`;
      const results = await normativeChunkRepository.findSimilarByAgent(vectorStr, limit, 'seismic');

      if (!results || results.length === 0) {
        return 'Nu am găsit informații seismice relevante în normativele indexate (P100-1/2013).';
      }

      let context = '=== Context Seismic (P100-1/2013) ===\n';
      results.forEach((r: any) => {
        context += `\n[${r.source} | ${r.chapter}]\n${r.content}\n`;
      });
      return context;
    } catch (error) {
      console.error('[ragAgentSeismic] Eroare:', error);
      return '';
    }
  }
};
