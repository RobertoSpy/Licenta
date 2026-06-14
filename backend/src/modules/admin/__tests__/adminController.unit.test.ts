import { syncDedemanMaterials, addMaterialFromUrl, addMaterialManual, importMaterialsCsv, getUsers, getAllMaterials, updateMaterial, deleteMaterial, reseedNormatives } from '../adminController';
import { scraperService } from '../../../core/infrastructure/scraperService';
import { prisma } from '../../../lib/prisma';
import fs from 'fs';

jest.mock('../../../core/infrastructure/scraperService');
jest.mock('fs', () => ({
  createReadStream: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    material: { create: jest.fn(), upsert: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    priceHistory: { create: jest.fn() },
    user: { findMany: jest.fn() }
  }
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('adminController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncDedemanMaterials', () => {
    it('returns success when scraper completes', async () => {
      const mockResult = { updated: 5, failed: 1 };
      (scraperService.syncAllMaterials as jest.Mock).mockResolvedValue(mockResult);

      const req: any = {};
      const res = mockRes();
      await syncDedemanMaterials(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, updated: 5 }));
    });

    it('returns 500 on scraper error', async () => {
      (scraperService.syncAllMaterials as jest.Mock).mockRejectedValue(new Error('Scraping error'));
      const req: any = {};
      const res = mockRes();
      await syncDedemanMaterials(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('addMaterialFromUrl', () => {
    it('returns 400 if required fields are missing', async () => {
      const req: any = { body: {} };
      const res = mockRes();
      await addMaterialFromUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 if scraping fails', async () => {
      (scraperService.scrapeOne as jest.Mock).mockResolvedValue(null);
      const req: any = { body: { url: 'url', internalCode: 'C1', name: 'N1', category: 'C', unit: 'buc' } };
      const res = mockRes();
      await addMaterialFromUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 if scraped price is 0 and not in stock', async () => {
      (scraperService.scrapeOne as jest.Mock).mockResolvedValue({ price: 0, inStock: false });
      const req: any = { body: { url: 'url', internalCode: 'C1', name: 'N1', category: 'C', unit: 'buc' } };
      const res = mockRes();
      await addMaterialFromUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates material and price history on success', async () => {
      (scraperService.scrapeOne as jest.Mock).mockResolvedValue({ price: 100, inStock: true, stockQuantity: 50 });
      (prisma.material.create as jest.Mock).mockResolvedValue({ id: 1 });
      
      const req: any = { body: { url: 'url', internalCode: 'C1', name: 'N1', category: 'C', unit: 'buc' } };
      const res = mockRes();
      await addMaterialFromUrl(req, res);

      expect(prisma.material.create).toHaveBeenCalled();
      expect(prisma.priceHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ materialId: 1, price: 100 }) }));
      expect(res.json).toHaveBeenCalledWith({ success: true, material: { id: 1 } });
    });

    it('returns 500 on db error', async () => {
      (scraperService.scrapeOne as jest.Mock).mockResolvedValue({ price: 100, inStock: true });
      (prisma.material.create as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const req: any = { body: { url: 'url', internalCode: 'C1', name: 'N1', category: 'C', unit: 'buc' } };
      const res = mockRes();
      await addMaterialFromUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('addMaterialManual', () => {
    it('returns 400 if required fields are missing', async () => {
      const req: any = { body: { internalCode: 'C1' } };
      const res = mockRes();
      await addMaterialManual(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates material manually', async () => {
      (prisma.material.create as jest.Mock).mockResolvedValue({ id: 2 });
      const req: any = { body: { internalCode: 'C2', name: 'N2', category: 'C', unit: 'kg', pricePerUnit: 10 } };
      const res = mockRes();
      await addMaterialManual(req, res);
      
      expect(prisma.material.create).toHaveBeenCalled();
      expect(prisma.priceHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ price: 10 }) }));
      expect(res.json).toHaveBeenCalledWith({ success: true, material: { id: 2 } });
    });

    it('returns 500 on manual create error', async () => {
      (prisma.material.create as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const req: any = { body: { internalCode: 'C2', name: 'N2', category: 'C', unit: 'kg', pricePerUnit: 10 } };
      const res = mockRes();
      await addMaterialManual(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('importMaterialsCsv', () => {
    it('returns 400 if no file provided', async () => {
      const req: any = {};
      const res = mockRes();
      await importMaterialsCsv(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getters and mutators', () => {
    it('getUsers returns users list', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
      const req: any = {};
      const res = mockRes();
      await getUsers(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, users: [{ id: 1 }] });
    });

    it('getAllMaterials returns materials list', async () => {
      (prisma.material.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
      const req: any = {};
      const res = mockRes();
      await getAllMaterials(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, materials: [{ id: 1 }] });
    });

    it('updateMaterial updates material', async () => {
      (prisma.material.update as jest.Mock).mockResolvedValue({ id: 1, name: 'Updated' });
      const req: any = { params: { id: '1' }, body: { name: 'Updated' } };
      const res = mockRes();
      await updateMaterial(req, res);
      expect(prisma.material.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'Updated' } });
      expect(res.json).toHaveBeenCalledWith({ success: true, material: { id: 1, name: 'Updated' } });
    });

    it('deleteMaterial deletes material', async () => {
      const req: any = { params: { id: '1' } };
      const res = mockRes();
      await deleteMaterial(req, res);
      expect(prisma.material.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Material șters cu succes.' });
    });

    it('returns 500 on getters or mutators error', async () => {
      (prisma.user.findMany as jest.Mock).mockRejectedValue(new Error('Err'));
      const req: any = {};
      const res = mockRes();
      await getUsers(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      
      (prisma.material.findMany as jest.Mock).mockRejectedValue(new Error('Err'));
      await getAllMaterials(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (prisma.material.update as jest.Mock).mockRejectedValue(new Error('Err'));
      req.params = { id: '1' };
      await updateMaterial(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (prisma.material.delete as jest.Mock).mockRejectedValue(new Error('Err'));
      await deleteMaterial(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('reseedNormatives returns success', async () => {
      const req: any = {};
      const res = mockRes();
      await reseedNormatives(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
