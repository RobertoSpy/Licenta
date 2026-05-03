import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') }); // Root .env
import { GoogleGenAI } from '@google/genai';
//converteste textul in vectori numerici pentru a putea fi cautat dupa inteles
// Instantiem clientul; cauta automat variabila GEMINI_API_KEY din env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 

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
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
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
