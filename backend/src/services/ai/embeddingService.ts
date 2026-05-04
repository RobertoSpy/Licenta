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
   * Model default folosit de Google pt embeddings text: text-embedding-004
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('Text is required for embedding');
    }

    try {
      const response = await getAi().models.embedContent({
        model: 'gemini-embedding-2',
        contents: text,
      });
      
      // Returnam prima valoare a vectorilor (deoarece cerem continut pentru o singură intrare)
      if (response && response.embeddings && response.embeddings.length > 0) {
          const vector = response.embeddings[0].values;
          if (vector) return vector;
      }
      throw new Error("Nu s-a putut obține vectorul din răspunsul Gemini");

    } catch (error) {
      console.error('Eroare detaliată Gemini Embedding:', error);
      throw error;
    }
  }
};
