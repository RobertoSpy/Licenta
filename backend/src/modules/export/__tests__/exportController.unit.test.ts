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
  });
});
