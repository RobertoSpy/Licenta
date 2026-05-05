import { embeddingService } from './embeddingService';
import { normativeChunkRepository } from '../../repositories/normativeChunkRepository';

/**
 * Agent Materiale — caută în cataloage de materiale de construcție:
 * - Date de la furnizori (Leroy Merlin, Dedeman, Bricostore) — web-scraping în Faza 2+
 * - Fișe tehnice materiale (beton, BCA, cărămidă, izolații)
 */
export const ragAgentMateriale = {
  async search(question: string, limit: number = 3): Promise<string> {
    try {
      const vectorArray = await embeddingService.embed(question);
      const vectorStr = `[${vectorArray.join(',')}]`;
      const results = await normativeChunkRepository.findSimilarByAgent(vectorStr, limit, 'materiale');

      if (!results || results.length === 0) {
        return 'Catalogul de materiale nu a fost indexat încă. Materialele vor fi disponibile după web-scraping din Faza 2.';
      }

      let context = '=== Context Materiale (Cataloage Furnizori) ===\n';
      results.forEach((r: any) => {
        context += `\n[${r.source} | ${r.chapter}]\n${r.content}\n`;
      });
      return context;
    } catch (error) {
      console.error('[ragAgentMateriale] Eroare:', error);
      return '';
    }
  }
};
