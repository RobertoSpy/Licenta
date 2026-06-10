import { exportController } from '../exportController';
import { exportService } from '../exportService';

jest.mock('../exportService');

describe('exportController (unit)', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.resetAllMocks();
    req = { params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn()
    };
  });

  describe('generatePlanPdf', () => {
    it('returns 400 for invalid projectId', async () => {
      req.params.projectId = 'abc';
      await exportController.generatePlanPdf(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'projectId invalid' });
    });

    it('returns 404 if exportService returns null', async () => {
      req.params.projectId = '1';
      (exportService.generatePlanPdf as jest.Mock).mockResolvedValue(null);
      await exportController.generatePlanPdf(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('Content-Disposition header contains slugified project title, not raw title', async () => {
      req.params.projectId = '1';
      const fakeBuffer = Buffer.from('PDF Content');
      (exportService.generatePlanPdf as jest.Mock).mockResolvedValue({
        filename: 'plan-parter-casa-mea-v1.pdf',
        buffer: fakeBuffer
      });

      await exportController.generatePlanPdf(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="plan-parter-casa-mea-v1.pdf"');
    });

    it('Content-Length matches actual buffer size', async () => {
      req.params.projectId = '1';
      const fakeBuffer = Buffer.from('12345');
      (exportService.generatePlanPdf as jest.Mock).mockResolvedValue({ filename: 'file.pdf', buffer: fakeBuffer });

      await exportController.generatePlanPdf(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 5);
    });

    it('Content-Type is exactly "application/pdf", not "application/pdf; charset=utf-8"', async () => {
      req.params.projectId = '1';
      (exportService.generatePlanPdf as jest.Mock).mockResolvedValue({ filename: 'file.pdf', buffer: Buffer.from('') });

      await exportController.generatePlanPdf(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    });

    it('returns 500 on error', async () => {
      req.params.projectId = '1';
      (exportService.generatePlanPdf as jest.Mock).mockRejectedValue(new Error('err'));
      await exportController.generatePlanPdf(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('generateContractorPdf', () => {
    it('returns 400 for invalid quoteId', async () => {
      req.params.quoteId = 'abc';
      await exportController.generateContractorPdf(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 if exportService returns null', async () => {
      req.params.quoteId = '1';
      req.user = { id: 2 };
      (exportService.generateContractorPdf as jest.Mock).mockResolvedValue(null);
      await exportController.generateContractorPdf(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns pdf buffer successfully', async () => {
      req.params.quoteId = '1';
      req.user = { id: 2 };
      req.body.planPngBase64 = 'b64';
      const fakeBuffer = Buffer.from('PDF Content');
      (exportService.generateContractorPdf as jest.Mock).mockResolvedValue({
        filename: 'contractor.pdf',
        buffer: fakeBuffer
      });

      await exportController.generateContractorPdf(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="contractor.pdf"');
      expect(res.send).toHaveBeenCalledWith(fakeBuffer);
    });

    it('returns 500 on error', async () => {
      req.params.quoteId = '1';
      (exportService.generateContractorPdf as jest.Mock).mockRejectedValue(new Error('err'));
      await exportController.generateContractorPdf(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
