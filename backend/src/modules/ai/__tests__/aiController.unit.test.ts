import { aiController, validateMaterialOverride } from '../aiController';
import { agentOrchestrator, suggestRoomProgram } from '../services/agentOrchestrator';
import { chatSummaryRepository } from '../chatSummaryRepository';
import { projectRepository } from '../../project/projectRepository';

jest.mock('../services/agentOrchestrator', () => ({
  agentOrchestrator: {
    getAiStreamForChat: jest.fn()
  },
  suggestRoomProgram: jest.fn()
}));

jest.mock('../chatSummaryRepository', () => ({
  chatSummaryRepository: {
    getOne: jest.fn(),
    upsert: jest.fn()
  }
}));

jest.mock('../../project/projectRepository', () => ({
  projectRepository: {
    findById: jest.fn()
  }
}));

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    material: { findUnique: jest.fn() },
    projectBOM: { findMany: jest.fn() }
  }
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.flushHeaders = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  res.on = jest.fn();
  return res;
}

describe('aiController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chatStream', () => {
    it('returns 400 if message is missing', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await aiController.chatStream(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('streams response successfully', async () => {
      const req: any = { body: { message: 'hello', contextString: 'ctx' } };
      const res = mockRes();

      async function* mockStream() {
        yield { text: 'Hel' };
        yield { text: 'lo' };
      }
      (agentOrchestrator.getAiStreamForChat as jest.Mock).mockResolvedValue(mockStream());

      await aiController.chatStream(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('Hel'));
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('lo'));
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('handles errors and writes error message to stream', async () => {
      const req: any = { body: { message: 'hello' } };
      const res = mockRes();
      (agentOrchestrator.getAiStreamForChat as jest.Mock).mockRejectedValue(new Error('503 Service Unavailable'));

      await aiController.chatStream(req, res);
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('suprasolicitat'));
    });
  });

  describe('summarizeConversation', () => {
    it('returns 400 if text is missing', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await aiController.summarizeConversation(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getSummary', () => {
    it('returns 400 if phase is missing', async () => {
      const req: any = { params: { projectId: '1' }, query: {} };
      const res = mockRes();
      await aiController.getSummary(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns summary', async () => {
      (chatSummaryRepository.getOne as jest.Mock).mockResolvedValue({ summary: 'test' });
      const req: any = { params: { projectId: '1' }, query: { phase: 'A' } };
      const res = mockRes();
      await aiController.getSummary(req, res);
      expect(res.json).toHaveBeenCalledWith({ summary: 'test' });
    });
  });

  describe('saveSummary', () => {
    it('returns 400 if phase or summary missing', async () => {
      const req: any = { body: { projectId: 1, phase: 'A' } };
      const res = mockRes();
      await aiController.saveSummary(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('saves summary and returns success', async () => {
      (chatSummaryRepository.upsert as jest.Mock).mockResolvedValue({ id: 10 });
      const req: any = { body: { projectId: 1, phase: 'A', summary: 'sum' } };
      const res = mockRes();
      await aiController.saveSummary(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, id: 10 });
    });
  });

  describe('suggestRooms', () => {
    it('returns 400 if required fields missing', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await aiController.suggestRooms(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid budget', async () => {
      const req: any = { body: { projectId: 1, familySize: 3, budgetCategory: 'invalid', houseAreaSqm: 100 } };
      const res = mockRes();
      await aiController.suggestRooms(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 if project not found', async () => {
      (projectRepository.findById as jest.Mock).mockResolvedValue(null);
      const req: any = { body: { projectId: 1, familySize: 3, budgetCategory: 'mediu', houseAreaSqm: 100 } };
      const res = mockRes();
      await aiController.suggestRooms(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns room suggestion', async () => {
      (projectRepository.findById as jest.Mock).mockResolvedValue({ plotAreaSqm: 500 });
      (suggestRoomProgram as jest.Mock).mockResolvedValue({ living: 30 });
      const req: any = { body: { projectId: 1, familySize: 3, budgetCategory: 'mediu', houseAreaSqm: 100 } };
      const res = mockRes();
      await aiController.suggestRooms(req, res);
      expect(res.json).toHaveBeenCalledWith({ living: 30 });
    });
  });
});
