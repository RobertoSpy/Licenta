import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../../../tests/setup';
import bomRoutes from '../bomRoutes';
import { bomService } from '../bomService';

const app = express();
app.use(express.json());

// Mockăm autentificarea (protect) și autorizarea (tenantGuard)
// Notă: Securitatea reală a middleware-urilor este testată în detaliu în authRoutes/tenantGuard unit tests.
// Aici doar ne asigurăm că rutele noastre BOM le aplică corect (Wired up correctly).
jest.mock('../../../core/middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    req.user = { id: parseInt(req.headers['x-user-id'] || '1', 10), role: 'CLIENT' };
    next();
  },
  requireRole: () => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../../core/middleware/tenantGuard', () => ({
  tenantGuard: (req: any, res: any, next: any) => {
    const projectId = parseInt(req.params.projectId, 10);
    // Logica simplificată de ownership mock: User N owns Project N.
    if (req.user.id !== projectId) {
      return res.status(403).json({ message: 'Forbidden: You do not own this project' });
    }
    next();
  }
}));

// Mockăm logica bomService pentru a testa doar controllerul
jest.mock('../bomService', () => ({
  bomService: {
    calculateBOM: jest.fn(),
    updateMaterialOverride: jest.fn(),
  }
}));

app.use('/api/bom', bomRoutes);

describe('BOM Module API (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Securitate & Autentificare (Wired Up)', () => {
    it('ar trebui sa returneze 401 daca lipseste tokenul de autentificare', async () => {
      const res = await request(app).post('/api/bom/1/generate');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    it('ar trebui sa returneze 403 daca utilizatorul acceseaza devizul altui proiect (Ownership)', async () => {
      // Userul 2 incearca sa acceseze proiectul 1
      const res = await request(app)
        .post('/api/bom/1/generate')
        .set('Authorization', 'Bearer MOCK_TOKEN')
        .set('x-user-id', '2');
      
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Forbidden: You do not own this project');
    });
  });

  describe('Rute Valide', () => {
    it('POST /api/bom/:projectId/generate - Ar trebui sa genereze BOM-ul', async () => {
      const mockBomItems = [{ id: 1, materialId: 10, phase: 'fundatie', quantity: 5 }];
      (bomService.calculateBOM as jest.Mock).mockResolvedValue(mockBomItems);

      const res = await request(app)
        .post('/api/bom/1/generate')
        .set('Authorization', 'Bearer MOCK_TOKEN')
        .set('x-user-id', '1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockBomItems);
      expect(bomService.calculateBOM).toHaveBeenCalledWith(1);
    });

    it('PATCH /api/bom/:projectId/material - Ar trebui sa suprascrie un material', async () => {
      const mockBomItems = [{ id: 1, formulaKey: 'beton_fundatie', materialId: 20 }];
      (bomService.updateMaterialOverride as jest.Mock).mockResolvedValue(mockBomItems);

      const res = await request(app)
        .patch('/api/bom/1/material')
        .set('Authorization', 'Bearer MOCK_TOKEN')
        .set('x-user-id', '1')
        .send({
          formulaKey: 'beton_fundatie',
          newMaterialCode: 'BET-NOU'
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockBomItems);
      expect(bomService.updateMaterialOverride).toHaveBeenCalledWith(1, 'beton_fundatie', 'BET-NOU');
    });

    it('PATCH /api/bom/:projectId/material - Ar trebui sa returneze 400 pt input invalid', async () => {
      const res = await request(app)
        .patch('/api/bom/1/material')
        .set('Authorization', 'Bearer MOCK_TOKEN')
        .set('x-user-id', '1')
        .send({ formulaKey: 'beton_fundatie' }); // Lipseste newMaterialCode

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Necesită formulaKey și newMaterialCode');
    });
  });
});
