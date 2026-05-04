import { normativeChunkRepository } from '../../repositories/normativeChunkRepository';
import { embeddingService } from './embeddingService';
//ragService vectorizeaza intrebarea si striga la nom=rmativeChunksrepo
export const ragService = {
  /**
   * Caută cele mai relevante X paragrafe din baza de cunoștințe (NormativeChunk)
   * pe baza query-ului textului propus folosind PgVector.
   */
  async searchRelevantChunks(question: string, limit: number = 3): Promise<string> {
    try {
      // 1. Convertim întrebarea într-un vector matematic
      const questionVectorArray = await embeddingService.embed(question);
      const vectorStr = `[${questionVectorArray.join(',')}]`;

      const results = await normativeChunkRepository.findSimilar(vectorStr, limit);

      if (!results || results.length === 0) {
        return "Nu am găsit informații în normativele indexate.";
      }

      // 3. Compunem textul găsit pentru a fi înțeles de LLM
      let contextStr = "Fragmente legislative extrase:\n";
      results.forEach((r: any) => {
        contextStr += `\n[Sursa: ${r.source} | Capitol: ${r.chapter}]\n${r.content}\n`;
      });

      return contextStr;

    } catch (error) {
      console.error("Eroare la RAG similarity search:", error);
      return "Acest asistent RAG întâmpină probleme de conectivitate limitată.";
    }
  }
};
