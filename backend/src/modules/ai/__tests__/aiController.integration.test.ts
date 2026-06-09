import request from 'supertest';
import express from 'express';
import { aiController, validateMaterialOverride } from '../aiController';
import { agentOrchestrator, suggestRoomProgram } from '../services/agentOrchestrator';
import { chatSummaryRepository } from '../chatSummaryRepository';
import { projectRepository } from '../../project/projectRepository';

// Mock dependencies
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({ text: 'Mock response' }),
      generateContentStream: jest.fn().mockImplementation(async function* () {
        yield { text: 'Stream part' };
      }),
      embedContent: jest.fn().mockResolvedValue({
        embeddings: [{ values: [0.1, 0.2, 0.3] }]
      })
    }
  }))
}));

jest.mock('../services/agentOrchestrator');
jest.mock('../chatSummaryRepository');
jest.mock('../../project/projectRepository');
jest.mock('../services/ragService', () => ({
  searchHybrid: jest.fn().mockResolvedValue([{ content: 'Mock RAG content', source: 'CR6', chapter: '1.2' }])
}));
jest.mock('../services/materialAnalyzer', () => ({
  materialAnalyzer: {
    explainMaterial: jest.fn().mockImplementation(async function* () {
      yield 'Stream part';
    }),
    explainMaterialById: jest.fn().mockImplementation(async function* () {
      yield 'Stream part by ID';
    })
  }
}));

jest.mock('../services/aiClient', () => ({
  getAi: jest.fn(),
  FALLBACK_MODELS_CHAT: ['model-1']
}));

const app = express();
app.use(express.json());

// Simplest mock routes mapped directly to controller methods
app.post('/api/ai/chat', aiController.chatStream);
app.post('/api/ai/summary', aiController.saveSummary);
app.get('/api/ai/summary/:projectId', aiController.getSummary);
app.post('/api/ai/suggest-rooms', aiController.suggestRooms);
app.post('/api/ai/summarize', aiController.summarizeConversation);
app.post('/api/ai/validate-override', validateMaterialOverride);
app.get('/api/ai/explain', aiController.explainMaterial);
app.post('/api/ai/explain', aiController.explainMaterial);
app.get('/api/ai/explain/:materialId', aiController.explainMaterialById);

describe('aiController (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test_key';
  });

  describe('POST /api/ai/chat', () => {
    it('ar trebui sa returneze 400 daca nu exista mesaj', async () => {
      const response = await request(app).post('/api/ai/chat').send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Mesajul este obligatoriu.');
    });

    it('ar trebui sa seteze headerele SSE si sa scrie date din stream', async () => {
      // Mock-uim un stream asincron simplu
      async function* mockStream() {
        yield { text: 'Hello' };
        yield { text: ' World' };
      }

      (agentOrchestrator.getAiStreamForChat as jest.Mock).mockResolvedValue(mockStream());

      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'Salut', screenContext: 'screen1' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.text).toContain('data: {"text":"Hello"}');
      expect(response.text).toContain('data: {"text":" World"}');
      expect(response.text).toContain('data: [DONE]');
      expect(agentOrchestrator.getAiStreamForChat).toHaveBeenCalledWith(
        'Salut',
        'Fără context special generat din formularul anterior.',
        [],
        'screen1',
        null
      );
    });
  });

  describe('POST /api/ai/summary', () => {
    it('ar trebui sa salveze rezumatul', async () => {
      (chatSummaryRepository.upsert as jest.Mock).mockResolvedValue({ id: 10 });

      const response = await request(app)
        .post('/api/ai/summary')
        .send({ projectId: 1, phase: 'faza1', summary: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(chatSummaryRepository.upsert).toHaveBeenCalledWith(1, 'faza1', null, 'test');
    });

    it('ar trebui sa returneze 400 daca lipsesc date', async () => {
      const response = await request(app).post('/api/ai/summary').send({ projectId: 1 });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/ai/summary/:projectId', () => {
    it('ar trebui sa returneze rezumatul existent', async () => {
      (chatSummaryRepository.getOne as jest.Mock).mockResolvedValue({ summary: 'istoric' });

      const response = await request(app).get('/api/ai/summary/1?phase=faza1&screen=screen1');

      expect(response.status).toBe(200);
      expect(response.body.summary).toBe('istoric');
      expect(chatSummaryRepository.getOne).toHaveBeenCalledWith(1, 'faza1', 'screen1');
    });
  });

  describe('POST /api/ai/suggest-rooms', () => {
    it('ar trebui sa returneze 400 pt budgetCategory invalid', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-rooms')
        .send({ projectId: 1, familySize: 4, budgetCategory: 'invalid', houseAreaSqm: 100 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('budgetCategory invalid');
    });

    it('ar trebui sa returneze 404 daca proiectul nu exista', async () => {
      (projectRepository.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/ai/suggest-rooms')
        .send({ projectId: 999, familySize: 4, budgetCategory: 'mediu', houseAreaSqm: 100 });

      expect(response.status).toBe(404);
    });

    it('ar trebui sa returneze suggestiile de la orchestrator in caz de succes', async () => {
      (projectRepository.findById as jest.Mock).mockResolvedValue({ id: 1, plotAreaSqm: 500 });
      (suggestRoomProgram as jest.Mock).mockResolvedValue({ rooms: [] });

      const response = await request(app)
        .post('/api/ai/suggest-rooms')
        .send({ projectId: 1, familySize: 4, budgetCategory: 'mediu', houseAreaSqm: 100 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ rooms: [] });
      expect(suggestRoomProgram).toHaveBeenCalled();
    });
  });

  describe('POST /api/ai/summarize', () => {
    it('ar trebui sa returneze sumarul folosind model.generateContent', async () => {
      const response = await request(app)
        .post('/api/ai/summarize')
        .send({ text: 'text lung de rezumat' });

      expect(response.status).toBe(200);
      expect(response.body.summary).toBe('Mock response');
    });
  });

  describe('GET /api/ai/explain', () => {
    it('ar trebui sa returneze o eroare daca lipsesc parametrii base si alt', async () => {
      const response = await request(app).get('/api/ai/explain');
      expect(response.status).toBe(200); // the API returns 200 with an error in the stream
      expect(response.text).toContain('Eroare: parametri lipsă');
    });

    it('ar trebui sa returneze stream-ul cu explicatia (GET legacy)', async () => {
      const response = await request(app).get('/api/ai/explain?base=Caramida&alt=BCA');
      expect(response.status).toBe(200);
      expect(response.text).toContain('Stream part');
    });
  });

  describe('POST /api/ai/explain', () => {
    it('ar trebui sa returneze o eroare daca lipsesc parametrii (POST)', async () => {
      const response = await request(app).post('/api/ai/explain').send({});
      expect(response.status).toBe(200);
      expect(response.text).toContain('Eroare: lipsă');
    });
  });

  describe('GET /api/ai/explain/:materialId', () => {
    it('ar trebui sa returneze 400 daca ID-ul este invalid', async () => {
      const response = await request(app).get('/api/ai/explain/invalid');
      expect(response.status).toBe(400);
    });
  });
});
