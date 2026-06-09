import { GoogleGenAI } from '@google/genai';
// converteste textul in vectori numerici pentru a putea fi cautat dupa inteles

// Funcție pentru inițializare lazy a clientului
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

export const embeddingService = {
  /**
   * Generează vectori pentru un fragment de text.
  * Model default folosit de Google pt embeddings text: gemini-embedding-001
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('Text is required for embedding');
    }

    const preferredModel = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-001';
    const modelFallbacks = [
      preferredModel,
      'models/gemini-embedding-001',
      'models/gemini-embedding-2',
    ];
    let lastError: unknown = null;

    for (const model of modelFallbacks) {
      try {
        const response = await getAi().models.embedContent({
          model,
          contents: text,
          config: {
            outputDimensionality: 768,
          },
        });

        // Returnam prima valoare a vectorilor (deoarece cerem continut pentru o singură intrare)
        if (response && response.embeddings && response.embeddings.length > 0) {
          const vector = response.embeddings[0].values;
          if (vector) return vector;
        }

        throw new Error('Nu s-a putut obține vectorul din răspunsul Gemini');
      } catch (error: any) {
        lastError = error;
        const message = error?.message || '';
        const status = error?.status;
        const isModelMissing = status === 404 || message.includes('is not found') || message.includes('NOT_FOUND');
        if (!isModelMissing) {
          console.error('Eroare detaliată Gemini Embedding:', error);
          throw error;
        }
      }
    }

    console.error('Eroare detaliată Gemini Embedding:', lastError);
    throw lastError;
  }
};
