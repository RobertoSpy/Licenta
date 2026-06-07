import { agentOrchestrator, suggestRoomProgram } from '../services/agentOrchestrator';
import { getAi } from '../services/aiClient';
import { isOffTopic, detectRequiredAgents } from '../services/agentRouter';
import { validateRoomSuggestion } from '../services/roomProgramPrompt';

jest.mock('../services/aiClient', () => ({
  getAi: jest.fn(),
  FALLBACK_MODELS_CHAT: ['model-1', 'model-2'],
  FALLBACK_MODELS_JSON: ['model-json-1', 'model-json-2'],
  MAX_RETRIES_PER_MODEL: 2
}));

jest.mock('../services/agentRouter', () => ({
  isOffTopic: jest.fn(),
  detectRequiredAgents: jest.fn().mockResolvedValue(['architectural'])
}));

jest.mock('../services/promptBuilder', () => ({
  buildRAGContext: jest.fn().mockResolvedValue('RAG context'),
  getStatusDisclaimer: jest.fn().mockReturnValue('Disclaimer'),
  agentLabel: jest.fn().mockReturnValue('Label')
}));

jest.mock('../services/chatPromptBuilder', () => ({
  buildChatPrompt: jest.fn().mockReturnValue('Prompt text'),
  buildOffTopicRefusalStream: jest.fn().mockReturnValue('Off-topic stream')
}));

jest.mock('../services/roomProgramPrompt', () => ({
  buildRoomProgramPrompt: jest.fn().mockReturnValue('Room prompt'),
  validateRoomSuggestion: jest.fn()
}));

jest.mock('../services/ragService', () => ({
  searchHybrid: jest.fn().mockResolvedValue([])
}));

describe('agentOrchestrator', () => {
  let mockGenerateContentStream: jest.Mock;
  let mockGenerateContent: jest.Mock;

  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => { cb(); return 0 as any; });

    mockGenerateContentStream = jest.fn();
    mockGenerateContent = jest.fn();

    (getAi as jest.Mock).mockReturnValue({
      models: {
        generateContentStream: mockGenerateContentStream,
        generateContent: mockGenerateContent
      }
    });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  describe('getAiStreamForChat', () => {
    it('ar trebui sa returneze stream de refuz daca este off-topic', async () => {
      (isOffTopic as jest.Mock).mockReturnValue(true);

      const result = await agentOrchestrator.getAiStreamForChat('reteta de clatite', 'context');
      expect(result).toBe('Off-topic stream');
      expect(mockGenerateContentStream).not.toHaveBeenCalled();
    });

    it('ar trebui sa returneze stream-ul corect pe primul model in caz de succes', async () => {
      (isOffTopic as jest.Mock).mockReturnValue(false);
      mockGenerateContentStream.mockResolvedValue('Valid Stream');

      const result = await agentOrchestrator.getAiStreamForChat('intrebare', 'context');

      expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
      expect(mockGenerateContentStream).toHaveBeenCalledWith({
        model: 'model-1',
        contents: 'Prompt text'
      });
      expect(result).toBe('Valid Stream');
    });

    it('ar trebui sa faca retry pe acelasi model daca primeste eroare 503, apoi sa reia in caz de succes', async () => {
      (isOffTopic as jest.Mock).mockReturnValue(false);
      
      const error503 = new Error('503 Service Unavailable');
      (error503 as any).status = 503;

      mockGenerateContentStream
        .mockRejectedValueOnce(error503) // 1st try (model 1) fails
        .mockResolvedValueOnce('Valid Stream 2nd Try'); // 2nd try (model 1) succeeds

      const promise = agentOrchestrator.getAiStreamForChat('intrebare', 'context');
      
      // simply await the promise
      const result = await promise;

      expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
      expect(mockGenerateContentStream).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'model-1' }));
      expect(mockGenerateContentStream).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'model-1' }));
      expect(result).toBe('Valid Stream 2nd Try');
    });

    it('ar trebui sa faca fallback pe al doilea model daca primul da fail iremediabil (non-503)', async () => {
      (isOffTopic as jest.Mock).mockReturnValue(false);
      
      const error400 = new Error('Bad Request');
      (error400 as any).status = 400;

      mockGenerateContentStream
        .mockRejectedValueOnce(error400) // model 1 fails directly
        .mockResolvedValueOnce('Valid Stream Model 2'); // model 2 succeeds

      const result = await agentOrchestrator.getAiStreamForChat('intrebare', 'context');

      expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
      expect(mockGenerateContentStream).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'model-1' }));
      expect(mockGenerateContentStream).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'model-2' }));
      expect(result).toBe('Valid Stream Model 2');
    });

    it('ar trebui sa arunce eroare daca toate modelele esueaza', async () => {
      (isOffTopic as jest.Mock).mockReturnValue(false);
      
      const error500 = new Error('Internal Server Error');
      mockGenerateContentStream.mockRejectedValue(error500);

      const promise = agentOrchestrator.getAiStreamForChat('intrebare', 'context');
      
      await expect(promise).rejects.toThrow('Serviciul de asistență tehnică este momentan indisponibil pe toate modelele.');
      // Cu max retries=2 și 2 modele, ar trebui sa treaca prin ambele fara retry pt 500
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(2); 
    });
  });

  describe('suggestRoomProgram', () => {
    const mockInput = { houseAreaSqm: 100, familySize: 4 } as any;

    it('ar trebui sa returneze json parsat in caz de succes', async () => {
      mockGenerateContent.mockResolvedValue({ text: '{"rooms": []}' });
      (validateRoomSuggestion as jest.Mock).mockReturnValue({ validated: true, rooms: [] });

      const result = await suggestRoomProgram(mockInput);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(validateRoomSuggestion).toHaveBeenCalled();
      expect(result).toEqual({ validated: true, rooms: [] });
    });

    it('ar trebui sa faca retry daca validarea esueaza (eroare de JSON sau logica)', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({ text: '{"rooms": []}' })
        .mockResolvedValueOnce({ text: '{"rooms": []}' });

      (validateRoomSuggestion as jest.Mock)
        .mockImplementationOnce(() => { throw new Error('Validare eșuată'); })
        .mockReturnValueOnce({ validated: true, rooms: [] });

      const promise = suggestRoomProgram(mockInput);
      
      const result = await promise;

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      // Prima oara a picat validarea pe model-json-1, a doua oara a mers tot pe el
      expect(mockGenerateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'model-json-1' }));
      expect(mockGenerateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'model-json-1' }));
      expect(result).toEqual({ validated: true, rooms: [] });
    });

    it('ar trebui sa faca fallback pe model-json-2 daca model-json-1 esueaza repetat', async () => {
      const error500 = new Error('Server error');

      mockGenerateContent
        .mockRejectedValueOnce(error500) // model 1 fails
        .mockResolvedValueOnce({ text: '{"rooms": []}' }); // model 2 succeeds

      (validateRoomSuggestion as jest.Mock).mockReturnValueOnce({ validated: true, rooms: [] });

      const result = await suggestRoomProgram(mockInput);

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockGenerateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'model-json-1' }));
      expect(mockGenerateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'model-json-2' }));
      expect(result).toEqual({ validated: true, rooms: [] });
    });
  });
});
