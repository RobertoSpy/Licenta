import request from 'supertest';
import express from 'express';
import exportRoutes from '../exportRoutes';
import { exportService } from '../exportService';

const app = express();
app.use(express.json());

// Mock middleware
jest.mock('../../../core/middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = { id: 1, role: 'CLIENT' };
    next();
  }
}));

jest.mock('../../../core/middleware/tenantGuard', () => ({
  tenantGuard: (req: any, res: any, next: any) => {
    if (req.params.projectId === '99') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  }
}));

jest.mock('../exportService');

app.use('/api/export', exportRoutes);

describe('Export API (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Method Validation (405)', () => {
    it('GET instead of POST returns 405 (method not allowed)', async () => {
      const res = await request(app).get('/api/export/plan-pdf/1').set('Authorization', 'Bearer token');
      expect(res.status).toBe(405);
      expect(res.body.message).toBe('Method Not Allowed');
    });

    it('PUT instead of POST returns 405', async () => {
      const res = await request(app).put('/api/export/contractor-pdf/1').set('Authorization', 'Bearer token');
      expect(res.status).toBe(405);
      expect(res.body.message).toBe('Method Not Allowed');
    });
  });

  describe('Authentication & Authorization', () => {
    it('returns 401 without authentication token', async () => {
      const res = await request(app).post('/api/export/plan-pdf/1');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });

    it('tenantGuard blocks access to other user projects (403)', async () => {
      const res = await request(app).post('/api/export/plan-pdf/99').set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Forbidden');
    });
  });

  describe('Success path', () => {
    it('returns 200 and PDF buffer when calling POST /plan-pdf/:id', async () => {
      (exportService.generatePlanPdf as jest.Mock).mockResolvedValue({
        filename: 'test.pdf',
        buffer: Buffer.from('PDF_DATA')
      });

      const res = await request(app)
        .post('/api/export/plan-pdf/1')
        .set('Authorization', 'Bearer token');
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.body).toBeInstanceOf(Buffer);
    });

    it('returns 200 and PDF buffer when calling POST /contractor-pdf/:quoteId', async () => {
      (exportService.generateContractorPdf as jest.Mock).mockResolvedValue({
        filename: 'contractor.pdf',
        buffer: Buffer.from('CONTRACTOR_PDF')
      });

      const res = await request(app)
        .post('/api/export/contractor-pdf/1')
        .set('Authorization', 'Bearer token');
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });
});
