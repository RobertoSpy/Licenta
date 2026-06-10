import { publishProject, getFeed, submitQuote, getProjectQuotes, acceptQuote, rejectQuote, getHistory, getForecast, getSummary } from '../marketController';
import { prisma } from '../../../lib/prisma';
import { marketService } from '../marketService';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    contractorProfile: { findUnique: jest.fn() },
    contractorQuote: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    constructionPhase: { updateMany: jest.fn() }
  }
}));

jest.mock('../marketService');

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('marketController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('publishProject', () => {
    it('returns 400 if projectId is invalid', async () => {
      const req: any = { params: { id: 'abc' } };
      const res = mockRes();
      await publishProject(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 if project not found', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);
      const req: any = { params: { id: '1' } };
      const res = mockRes();
      await publishProject(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 if user not owner', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ userId: 2 });
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await publishProject(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('publishes project', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ userId: 1 });
      (prisma.project.update as jest.Mock).mockResolvedValue({ isPublishedForBidding: true });
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await publishProject(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('returns 500 on error', async () => {
      (prisma.project.findUnique as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { id: '1' } };
      const res = mockRes();
      await publishProject(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getFeed', () => {
    it('returns 401 if user missing', async () => {
      const req: any = {};
      const res = mockRes();
      await getFeed(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 403 if not contractor', async () => {
      (prisma.contractorProfile.findUnique as jest.Mock).mockResolvedValue(null);
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getFeed(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns feed masking data for unverified contractor', async () => {
      (prisma.contractorProfile.findUnique as jest.Mock).mockResolvedValue({ isVerified: false });
      (prisma.project.findMany as jest.Mock).mockResolvedValue([{ user: { name: 'A', email: 'E', phone: '123' } }]);
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getFeed(req, res);
      expect(res.json).toHaveBeenCalledWith({
        isVerified: false,
        projects: [{ user: { name: 'A', email: 'E', phone: '*** (Cont Neverificat)' } }]
      });
    });

    it('returns full feed for verified contractor', async () => {
      (prisma.contractorProfile.findUnique as jest.Mock).mockResolvedValue({ isVerified: true });
      (prisma.project.findMany as jest.Mock).mockResolvedValue([{ user: { phone: '123' } }]);
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getFeed(req, res);
      expect(res.json).toHaveBeenCalledWith({
        isVerified: true,
        projects: [{ user: { phone: '123' } }]
      });
    });

    it('returns 500 on error', async () => {
      (prisma.contractorProfile.findUnique as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getFeed(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('submitQuote', () => {
    it('returns 400 for invalid data', async () => {
      const req: any = { params: { id: 'a' }, body: {}, user: { id: 1 } };
      const res = mockRes();
      await submitQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 if not contractor', async () => {
      (prisma.contractorProfile.findUnique as jest.Mock).mockResolvedValue(null);
      const req: any = { params: { id: '1' }, body: { selectedPhases: [] }, user: { id: 1 } };
      const res = mockRes();
      await submitQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 403 if unverified', async () => {
      (prisma.contractorProfile.findUnique as jest.Mock).mockResolvedValue({ isVerified: false });
      const req: any = { params: { id: '1' }, body: { selectedPhases: [] }, user: { id: 1 } };
      const res = mockRes();
      await submitQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('submits quote', async () => {
      (prisma.contractorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 10, isVerified: true });
      (prisma.contractorQuote.upsert as jest.Mock).mockResolvedValue({ id: 20 });
      const req: any = { params: { id: '1' }, body: { selectedPhases: [1, 2] }, user: { id: 1 } };
      const res = mockRes();
      await submitQuote(req, res);
      expect(prisma.contractorQuote.upsert).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ quote: { id: 20 } }));
    });

    it('returns 500 on error', async () => {
      (prisma.contractorProfile.findUnique as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { id: '1' }, body: { selectedPhases: [1] }, user: { id: 1 } };
      const res = mockRes();
      await submitQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getProjectQuotes', () => {
    it('returns 400 if invalid input', async () => {
      const req: any = { params: { id: 'abc' }, user: { id: 1 } };
      const res = mockRes();
      await getProjectQuotes(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 if not project owner', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ userId: 2 });
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await getProjectQuotes(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns quotes', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ userId: 1 });
      (prisma.contractorQuote.findMany as jest.Mock).mockResolvedValue([{ id: 10 }]);
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await getProjectQuotes(req, res);
      expect(res.json).toHaveBeenCalledWith([{ id: 10 }]);
    });

    it('returns 500 on error', async () => {
      (prisma.project.findUnique as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { id: '1' }, user: { id: 1 } };
      const res = mockRes();
      await getProjectQuotes(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('acceptQuote', () => {
    it('returns 400 for invalid data', async () => {
      const req: any = { params: { quoteId: 'abc' }, user: { id: 1 } };
      const res = mockRes();
      await acceptQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 if access denied', async () => {
      (prisma.contractorQuote.findUnique as jest.Mock).mockResolvedValue({ project: { userId: 2 } });
      const req: any = { params: { quoteId: '10' }, user: { id: 1 } };
      const res = mockRes();
      await acceptQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('accepts quote and updates phases', async () => {
      (prisma.contractorQuote.findUnique as jest.Mock).mockResolvedValue({
        id: 10, projectId: 1, contractorId: 5, project: { userId: 1 }, phases: [{ id: 100 }]
      });
      const req: any = { params: { quoteId: '10' }, user: { id: 1 } };
      const res = mockRes();
      await acceptQuote(req, res);
      expect(prisma.contractorQuote.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { status: 'ACCEPTED' } });
      expect(prisma.constructionPhase.updateMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Ofertă acceptată cu succes.' });
    });

    it('returns 500 on error', async () => {
      (prisma.contractorQuote.findUnique as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { quoteId: '10' }, user: { id: 1 } };
      const res = mockRes();
      await acceptQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('rejectQuote', () => {
    it('returns 400 for invalid data', async () => {
      const req: any = { params: { quoteId: 'abc' }, body: {}, user: { id: 1 } };
      const res = mockRes();
      await rejectQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 if access denied', async () => {
      (prisma.contractorQuote.findUnique as jest.Mock).mockResolvedValue({ project: { userId: 2 } });
      const req: any = { params: { quoteId: '10' }, body: {}, user: { id: 1 } };
      const res = mockRes();
      await rejectQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects quote', async () => {
      (prisma.contractorQuote.findUnique as jest.Mock).mockResolvedValue({
        id: 10, project: { userId: 1 }
      });
      const req: any = { params: { quoteId: '10' }, user: { id: 1 }, body: { clientMessage: 'Nu' } };
      const res = mockRes();
      await rejectQuote(req, res);
      expect(prisma.contractorQuote.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { status: 'REJECTED', clientMessage: 'Nu' } });
      expect(res.json).toHaveBeenCalledWith({ message: 'Ofertă refuzată cu succes.' });
    });

    it('returns 500 on error', async () => {
      (prisma.contractorQuote.findUnique as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { quoteId: '10' }, user: { id: 1 } };
      const res = mockRes();
      await rejectQuote(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Market Service APIs', () => {
    it('getHistory', async () => {
      (marketService.getIndexHistory as jest.Mock).mockResolvedValue([]);
      const res = mockRes();
      await getHistory({} as any, res);
      expect(res.json).toHaveBeenCalledWith({ data: [] });
    });

    it('getForecast', async () => {
      (marketService.getForecast as jest.Mock).mockResolvedValue([]);
      const res = mockRes();
      await getForecast({} as any, res);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('getSummary', async () => {
      (marketService.getSummary as jest.Mock).mockResolvedValue({});
      const res = mockRes();
      await getSummary({} as any, res);
      expect(res.json).toHaveBeenCalledWith({});
    });

    it('returns 500 on errors', async () => {
      (marketService.getSummary as jest.Mock).mockRejectedValue(new Error('err'));
      const res = mockRes();
      await getSummary({} as any, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (marketService.getIndexHistory as jest.Mock).mockRejectedValue(new Error('err'));
      const res2 = mockRes();
      await getHistory({} as any, res2);
      expect(res2.status).toHaveBeenCalledWith(500);

      (marketService.getForecast as jest.Mock).mockRejectedValue(new Error('err'));
      const res3 = mockRes();
      await getForecast({} as any, res3);
      expect(res3.status).toHaveBeenCalledWith(500);
    });
  });
});
