"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const agentOrchestrator_1 = require("../services/agentOrchestrator");
const aiClient_1 = require("../services/aiClient");
const agentRouter_1 = require("../services/agentRouter");
const roomProgramPrompt_1 = require("../services/roomProgramPrompt");
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
    let mockGenerateContentStream;
    let mockGenerateContent;
    let setTimeoutSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => { cb(); return 0; });
        mockGenerateContentStream = jest.fn();
        mockGenerateContent = jest.fn();
        aiClient_1.getAi.mockReturnValue({
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
        it('ar trebui sa returneze stream de refuz daca este off-topic', () => __awaiter(void 0, void 0, void 0, function* () {
            agentRouter_1.isOffTopic.mockReturnValue(true);
            const result = yield agentOrchestrator_1.agentOrchestrator.getAiStreamForChat('reteta de clatite', 'context');
            expect(result).toBe('Off-topic stream');
            expect(mockGenerateContentStream).not.toHaveBeenCalled();
        }));
        it('ar trebui sa returneze stream-ul corect pe primul model in caz de succes', () => __awaiter(void 0, void 0, void 0, function* () {
            agentRouter_1.isOffTopic.mockReturnValue(false);
            mockGenerateContentStream.mockResolvedValue('Valid Stream');
            const result = yield agentOrchestrator_1.agentOrchestrator.getAiStreamForChat('intrebare', 'context');
            expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
            expect(mockGenerateContentStream).toHaveBeenCalledWith({
                model: 'model-1',
                contents: 'Prompt text'
            });
            expect(result).toBe('Valid Stream');
        }));
        it('ar trebui sa faca retry pe acelasi model daca primeste eroare 503, apoi sa reia in caz de succes', () => __awaiter(void 0, void 0, void 0, function* () {
            agentRouter_1.isOffTopic.mockReturnValue(false);
            const error503 = new Error('503 Service Unavailable');
            error503.status = 503;
            mockGenerateContentStream
                .mockRejectedValueOnce(error503) // 1st try (model 1) fails
                .mockResolvedValueOnce('Valid Stream 2nd Try'); // 2nd try (model 1) succeeds
            const promise = agentOrchestrator_1.agentOrchestrator.getAiStreamForChat('intrebare', 'context');
            // simply await the promise
            const result = yield promise;
            expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
            expect(mockGenerateContentStream).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'model-1' }));
            expect(mockGenerateContentStream).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'model-1' }));
            expect(result).toBe('Valid Stream 2nd Try');
        }));
        it('ar trebui sa faca fallback pe al doilea model daca primul da fail iremediabil (non-503)', () => __awaiter(void 0, void 0, void 0, function* () {
            agentRouter_1.isOffTopic.mockReturnValue(false);
            const error400 = new Error('Bad Request');
            error400.status = 400;
            mockGenerateContentStream
                .mockRejectedValueOnce(error400) // model 1 fails directly
                .mockResolvedValueOnce('Valid Stream Model 2'); // model 2 succeeds
            const result = yield agentOrchestrator_1.agentOrchestrator.getAiStreamForChat('intrebare', 'context');
            expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
            expect(mockGenerateContentStream).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'model-1' }));
            expect(mockGenerateContentStream).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'model-2' }));
            expect(result).toBe('Valid Stream Model 2');
        }));
        it('ar trebui sa arunce eroare daca toate modelele esueaza', () => __awaiter(void 0, void 0, void 0, function* () {
            agentRouter_1.isOffTopic.mockReturnValue(false);
            const error500 = new Error('Internal Server Error');
            mockGenerateContentStream.mockRejectedValue(error500);
            const promise = agentOrchestrator_1.agentOrchestrator.getAiStreamForChat('intrebare', 'context');
            yield expect(promise).rejects.toThrow('Serviciul de asistență tehnică este momentan indisponibil pe toate modelele.');
            // Cu max retries=2 și 2 modele, ar trebui sa treaca prin ambele fara retry pt 500
            expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
        }));
    });
    describe('suggestRoomProgram', () => {
        const mockInput = { houseAreaSqm: 100, familySize: 4 };
        it('ar trebui sa returneze json parsat in caz de succes', () => __awaiter(void 0, void 0, void 0, function* () {
            mockGenerateContent.mockResolvedValue({ text: '{"rooms": []}' });
            roomProgramPrompt_1.validateRoomSuggestion.mockReturnValue({ validated: true, rooms: [] });
            const result = yield (0, agentOrchestrator_1.suggestRoomProgram)(mockInput);
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(roomProgramPrompt_1.validateRoomSuggestion).toHaveBeenCalled();
            expect(result).toEqual({ validated: true, rooms: [] });
        }));
        it('ar trebui sa faca retry daca validarea esueaza (eroare de JSON sau logica)', () => __awaiter(void 0, void 0, void 0, function* () {
            mockGenerateContent
                .mockResolvedValueOnce({ text: '{"rooms": []}' })
                .mockResolvedValueOnce({ text: '{"rooms": []}' });
            roomProgramPrompt_1.validateRoomSuggestion
                .mockImplementationOnce(() => { throw new Error('Validare eșuată'); })
                .mockReturnValueOnce({ validated: true, rooms: [] });
            const promise = (0, agentOrchestrator_1.suggestRoomProgram)(mockInput);
            const result = yield promise;
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);
            // Prima oara a picat validarea pe model-json-1, a doua oara a mers tot pe el
            expect(mockGenerateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'model-json-1' }));
            expect(mockGenerateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'model-json-1' }));
            expect(result).toEqual({ validated: true, rooms: [] });
        }));
        it('ar trebui sa faca fallback pe model-json-2 daca model-json-1 esueaza repetat', () => __awaiter(void 0, void 0, void 0, function* () {
            const error500 = new Error('Server error');
            mockGenerateContent
                .mockRejectedValueOnce(error500) // model 1 fails
                .mockResolvedValueOnce({ text: '{"rooms": []}' }); // model 2 succeeds
            roomProgramPrompt_1.validateRoomSuggestion.mockReturnValueOnce({ validated: true, rooms: [] });
            const result = yield (0, agentOrchestrator_1.suggestRoomProgram)(mockInput);
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);
            expect(mockGenerateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'model-json-1' }));
            expect(mockGenerateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'model-json-2' }));
            expect(result).toEqual({ validated: true, rooms: [] });
        }));
    });
});
