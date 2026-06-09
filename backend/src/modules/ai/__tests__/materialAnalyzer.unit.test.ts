import { materialAnalyzer } from '../services/materialAnalyzer';
import { prisma } from '../../../lib/prisma';
import { GoogleGenAI } from '@google/genai';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY' }
}));

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    material: {
      findMany: jest.fn(),
    },
  },
}));

describe('materialAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeMaterial', () => {
    it('ar trebui sa returneze rezultatul parsat din Gemini', async () => {
      (prisma.material.findMany as jest.Mock).mockResolvedValue([
        { internalCode: 'BCA_25' },
        { internalCode: 'CARAMIDA_30' }
      ]);

      const mockResponse = {
        text: JSON.stringify({
          standardCode: 'BCA_25',
          category: 'Zidărie',
          subcategory: 'Pereți exteriori',
          unit: 'mc',
          uValue: 0.45,
          pros: 'Izoleaza bine',
          cons: 'Absoarbe apa',
          description: 'Descriere test',
          brand: 'Ytong',
          genericAlternatives: ['Caramida']
        })
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await materialAnalyzer.analyzeMaterial('Ytong Forte 25', 500, 'http://test');

      expect(prisma.material.findMany).toHaveBeenCalled();
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
          contents: expect.stringContaining('Ytong Forte 25'),
        })
      );
      
      expect(result).not.toBeNull();
      expect(result?.standardCode).toBe('BCA_25');
      expect(result?.brand).toBe('Ytong');
      expect(result?.uValue).toBe(0.45);
    });

    it('ar trebui sa returneze null daca ai.models.generateContent returneaza text gol', async () => {
      (prisma.material.findMany as jest.Mock).mockResolvedValue([]);
      mockGenerateContent.mockResolvedValue({ text: null });

      const result = await materialAnalyzer.analyzeMaterial('Produs', 10, 'http://test');
      expect(result).toBeNull();
    });

    it('ar trebui sa returneze null daca procesarea esueaza (catch error)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (prisma.material.findMany as jest.Mock).mockResolvedValue([]);
      mockGenerateContent.mockRejectedValue(new Error('AI failed'));

      const result = await materialAnalyzer.analyzeMaterial('Produs', 10, 'http://test');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
