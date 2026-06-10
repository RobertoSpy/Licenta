import { getContractors, getContractorById, getMyProfile, updateMyProfile, addReview, getAcceptedProjects } from '../contractorController';
import { contractorService } from '../contractorService';

jest.mock('../contractorService');

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('contractorController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getContractors', () => {
    it('returns contractors list', async () => {
      (contractorService.getContractors as jest.Mock).mockResolvedValue([{ id: 1 }]);
      const req: any = { query: { county: 'B', specializations: 'Zidarie,Acoperis' } };
      const res = mockRes();
      await getContractors(req, res);
      expect(contractorService.getContractors).toHaveBeenCalledWith('B', ['Zidarie', 'Acoperis']);
      expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('handles errors', async () => {
      (contractorService.getContractors as jest.Mock).mockRejectedValue(new Error('error'));
      const req: any = { query: {} };
      const res = mockRes();
      await getContractors(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getContractorById', () => {
    it('returns 400 for invalid ID', async () => {
      const req: any = { params: { id: 'abc' } };
      const res = mockRes();
      await getContractorById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 if not found', async () => {
      (contractorService.getContractorById as jest.Mock).mockResolvedValue(null);
      const req: any = { params: { id: '1' } };
      const res = mockRes();
      await getContractorById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns contractor on success', async () => {
      (contractorService.getContractorById as jest.Mock).mockResolvedValue({ id: 1 });
      const req: any = { params: { id: '1' } };
      const res = mockRes();
      await getContractorById(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns 500 on error', async () => {
      (contractorService.getContractorById as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { params: { id: '1' } };
      const res = mockRes();
      await getContractorById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMyProfile', () => {
    it('returns 404 if not found', async () => {
      (contractorService.getProfileByUserId as jest.Mock).mockResolvedValue(null);
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getMyProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns profile', async () => {
      (contractorService.getProfileByUserId as jest.Mock).mockResolvedValue({ id: 1 });
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getMyProfile(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns 500 on error', async () => {
      (contractorService.getProfileByUserId as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getMyProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateMyProfile', () => {
    it('updates and returns profile', async () => {
      (contractorService.updateProfile as jest.Mock).mockResolvedValue({ id: 1, name: 'X' });
      const req: any = { user: { id: 1 }, body: { name: 'X' } };
      const res = mockRes();
      await updateMyProfile(req, res);
      expect(contractorService.updateProfile).toHaveBeenCalledWith(1, { name: 'X' });
      expect(res.json).toHaveBeenCalledWith({ id: 1, name: 'X' });
    });

    it('returns 500 on error', async () => {
      (contractorService.updateProfile as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { user: { id: 1 }, body: { name: 'X' } };
      const res = mockRes();
      await updateMyProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('addReview', () => {
    it('returns 400 for invalid ID', async () => {
      const req: any = { user: { id: 1 }, params: { id: 'a' } };
      const res = mockRes();
      await addReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid rating', async () => {
      const req: any = { user: { id: 1 }, params: { id: '1' }, body: { rating: 6, comment: 'test', projectId: '2' } };
      const res = mockRes();
      await addReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid comment', async () => {
      const req: any = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: '', projectId: '2' } };
      const res = mockRes();
      await addReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 403 if NOT_AUTHORIZED', async () => {
      (contractorService.addReview as jest.Mock).mockRejectedValue(new Error('NOT_AUTHORIZED_OR_NO_ACCEPTED_QUOTE'));
      const req: any = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: 'test', projectId: '2' } };
      const res = mockRes();
      await addReview(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 409 if ALREADY_REVIEWED', async () => {
      (contractorService.addReview as jest.Mock).mockRejectedValue(new Error('ALREADY_REVIEWED'));
      const req: any = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: 'test', projectId: '2' } };
      const res = mockRes();
      await addReview(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('adds review successfully', async () => {
      (contractorService.addReview as jest.Mock).mockResolvedValue({ id: 10 });
      const req: any = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: 'test', projectId: '2' } };
      const res = mockRes();
      await addReview(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, review: { id: 10 } });
    });

    it('returns 500 on generic error', async () => {
      (contractorService.addReview as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: 'test', projectId: '2' } };
      const res = mockRes();
      await addReview(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAcceptedProjects', () => {
    it('returns projects', async () => {
      (contractorService.getAcceptedProjects as jest.Mock).mockResolvedValue([{ id: 1 }]);
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getAcceptedProjects(req, res);
      expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('returns 500 on error', async () => {
      (contractorService.getAcceptedProjects as jest.Mock).mockRejectedValue(new Error('err'));
      const req: any = { user: { id: 1 } };
      const res = mockRes();
      await getAcceptedProjects(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
