import { requestQuotes, getClientQuotes, getContractorQuotes, submitQuote, acceptQuote } from '../quoteController';
import { quoteService } from '../quoteService';
import { AuthRequest } from '../../../core/middleware/authMiddleware';

jest.mock('../quoteService');

describe('Quote Controller Unit Tests', () => {
  let req: Partial<AuthRequest>;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 100, role: 'CLIENT' } as any
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  describe('requestQuotes', () => {
    it('returns 400 when request body fails validation (missing contractorIds)', async () => {
      req.body = { projectId: 1 };
      
      await requestQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('invalide') }));
    });

    it('returns 201 Created and success message when new quotes are requested', async () => {
      req.body = { projectId: 1, contractorIds: [10, 11] };
      (quoteService.requestQuotes as jest.Mock).mockResolvedValue({ count: 2 });

      await requestQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ count: 2, message: 'Cereri trimise cu succes.' });
    });

    it('returns 200 without message when count is 0', async () => {
      req.body = { projectId: 1, contractorIds: [10] };
      (quoteService.requestQuotes as jest.Mock).mockResolvedValue({ count: 0, message: 'Deja trimis' });

      await requestQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ count: 0, message: 'Deja trimis' });
    });

    it('maps Unauthorized error to 403', async () => {
      req.body = { projectId: 1, contractorIds: [10] };
      (quoteService.requestQuotes as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      await requestQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Acțiune nepermisă' });
    });

    it('maps generic Error to 500 without exposing stack trace', async () => {
      req.body = { projectId: 1, contractorIds: [10] };
      (quoteService.requestQuotes as jest.Mock).mockRejectedValue(new Error('Some DB explosion'));

      await requestQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Eroare la trimiterea cererii de ofertă' });
    });
  });

  describe('getClientQuotes', () => {
    it('returns 403 on Unauthorized', async () => {
      req.params = { projectId: '1' };
      (quoteService.getQuotesForClient as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      await getClientQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 on Project not found', async () => {
      req.params = { projectId: '1' };
      (quoteService.getQuotesForClient as jest.Mock).mockRejectedValue(new Error('Project not found'));

      await getClientQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Proiectul nu a fost găsit' });
    });

    it('returns quotes with 200 (implicit)', async () => {
      req.params = { projectId: '1' };
      (quoteService.getQuotesForClient as jest.Mock).mockResolvedValue([{ id: 1 }]);

      await getClientQuotes(req as AuthRequest, res);

      expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('returns 500 on generic error', async () => {
      req.params = { projectId: '1' };
      (quoteService.getQuotesForClient as jest.Mock).mockRejectedValue(new Error('err'));
      await getClientQuotes(req as AuthRequest, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getContractorQuotes', () => {
    it('maps Contractor profile not found to 404', async () => {
      (quoteService.getQuotesForContractor as jest.Mock).mockRejectedValue(new Error('Contractor profile not found'));

      await getContractorQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Profilul de constructor nu a fost găsit' });
    });

    it('returns 500 on generic error', async () => {
      (quoteService.getQuotesForContractor as jest.Mock).mockRejectedValue(new Error('Database err'));

      await getContractorQuotes(req as AuthRequest, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('submitQuote', () => {
    beforeEach(() => {
      req.params = { id: '1' };
      req.body = { totalAmount: 100 };
    });

    it('maps Unauthorized to 403', async () => {
      (quoteService.submitQuote as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
      await submitQuote(req as AuthRequest, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('maps not found to 404', async () => {
      (quoteService.submitQuote as jest.Mock).mockRejectedValue(new Error('Quote not found'));
      await submitQuote(req as AuthRequest, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('maps Validation to 400', async () => {
      (quoteService.submitQuote as jest.Mock).mockRejectedValue(new Error('Validation: amount required'));
      await submitQuote(req as AuthRequest, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Validation: amount required' });
    });

    it('returns success', async () => {
      (quoteService.submitQuote as jest.Mock).mockResolvedValue({ id: 1, status: 'SENT' });
      await submitQuote(req as AuthRequest, res);
      expect(res.json).toHaveBeenCalledWith({ id: 1, status: 'SENT' });
    });

    it('returns 500 on generic error', async () => {
      (quoteService.submitQuote as jest.Mock).mockRejectedValue(new Error('err'));
      await submitQuote(req as AuthRequest, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('acceptQuote', () => {
    beforeEach(() => {
      req.params = { id: '1' };
    });

    it('maps Unauthorized to 403', async () => {
      (quoteService.acceptQuote as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
      await acceptQuote(req as AuthRequest, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('maps not found to 404', async () => {
      (quoteService.acceptQuote as jest.Mock).mockRejectedValue(new Error('Quote not found'));
      await acceptQuote(req as AuthRequest, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns success', async () => {
      (quoteService.acceptQuote as jest.Mock).mockResolvedValue({ id: 1, status: 'ACCEPTED' });
      await acceptQuote(req as AuthRequest, res);
      expect(res.json).toHaveBeenCalledWith({ id: 1, status: 'ACCEPTED' });
    });

    it('returns 500 on generic error', async () => {
      (quoteService.acceptQuote as jest.Mock).mockRejectedValue(new Error('err'));
      await acceptQuote(req as AuthRequest, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
