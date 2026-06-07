import { embeddingService } from '../services/embeddingService';
import { GoogleGenAI } from '@google/genai';

const mockEmbedContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      embedContent: mockEmbedContent,
    },
  })),
}));

describe('embeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('embed', () => {
    it('ar trebui sa arunce o eroare daca textul este gol', async () => {
      await expect(embeddingService.embed('')).rejects.toThrow('Text is required for embedding');
      await expect(embeddingService.embed('   ')).rejects.toThrow('Text is required for embedding');
    });

    it('ar trebui sa returneze vectorii de la primul apel reusit', async () => {
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: [0.1, 0.2, 0.3] }]
      });

      const result = await embeddingService.embed('Text de test');
      
      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('ar trebui sa faca fallback la alt model daca primul nu este gasit (404)', async () => {
      const error404 = new Error('Model not found');
      (error404 as any).status = 404;

      mockEmbedContent
        .mockRejectedValueOnce(error404) // primul model fail
        .mockResolvedValueOnce({
          embeddings: [{ values: [0.4, 0.5, 0.6] }] // al doilea model success
        });

      const result = await embeddingService.embed('Fallback text');

      expect(mockEmbedContent).toHaveBeenCalledTimes(2);
      expect(result).toEqual([0.4, 0.5, 0.6]);
    });

    it('ar trebui sa arunce eroare imediat daca eroarea nu este 404', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error500 = new Error('Internal Server Error');
      (error500 as any).status = 500;

      mockEmbedContent.mockRejectedValueOnce(error500);

      await expect(embeddingService.embed('Eroare 500')).rejects.toThrow('Internal Server Error');
      expect(mockEmbedContent).toHaveBeenCalledTimes(1); // nu face fallback

      consoleSpy.mockRestore();
    });

    it('ar trebui sa arunce eroare daca toate modelele de fallback esueaza cu 404', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error404 = new Error('Model is not found');
      (error404 as any).status = 404;

      // Sunt 3 optiuni de model in cod
      mockEmbedContent
        .mockRejectedValueOnce(error404)
        .mockRejectedValueOnce(error404)
        .mockRejectedValueOnce(error404);

      await expect(embeddingService.embed('Toate esueaza')).rejects.toThrow('Model is not found');
      expect(mockEmbedContent).toHaveBeenCalledTimes(3);

      consoleSpy.mockRestore();
    });
  });
});
