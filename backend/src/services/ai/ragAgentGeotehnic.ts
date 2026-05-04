import { embeddingService } from './embeddingService';
import { normativeChunkRepository } from '../../repositories/normativeChunkRepository';

/**
 * Agent Geotehnic — caută exclusiv în documente despre sol și fundații:
 * - NP 112-2014 (Normativ proiectare fundații)
 * - NP 074-2022 (Normativ studii geotehnice)
 */
export const ragAgentGeotehnic = {
  async search(question: string, limit: number = 3): Promise<string> {
    try {
      const vectorArray = await embeddingService.embed(question);
      const vectorStr = `[${vectorArray.join(',')}]`;
      const results = await normativeChunkRepository.findSimilarByAgent(vectorStr, limit, 'geotehnic');

      if (!results || results.length === 0) {
        return 'Nu am găsit informații geotehnice relevante în normativele indexate (NP112-2014, NP074-2022).';
      }

      let context = '=== Context Geotehnic (NP112-2014, NP074-2022) ===\n';
      results.forEach((r: any) => {
        context += `\n[${r.source} | ${r.chapter}]\n${r.content}\n`;
      });
      return context;
    } catch (error) {
      console.error('[ragAgentGeotehnic] Eroare:', error);
      return '';
    }
  }
};
