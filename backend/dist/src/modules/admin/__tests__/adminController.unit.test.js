"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const adminController_1 = require("../adminController");
const scraperService_1 = require("../../../core/infrastructure/scraperService");
const prisma_1 = require("../../../lib/prisma");
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
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}
describe('adminController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('syncDedemanMaterials', () => {
        it('returns success when scraper completes', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockResult = { updated: 5, failed: 1 };
            scraperService_1.scraperService.syncAllMaterials.mockResolvedValue(mockResult);
            const req = {};
            const res = mockRes();
            yield (0, adminController_1.syncDedemanMaterials)(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, updated: 5 }));
        }));
        it('returns 500 on scraper error', () => __awaiter(void 0, void 0, void 0, function* () {
            scraperService_1.scraperService.syncAllMaterials.mockRejectedValue(new Error('Scraping error'));
            const req = {};
            const res = mockRes();
            yield (0, adminController_1.syncDedemanMaterials)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('addMaterialFromUrl', () => {
        it('returns 400 if required fields are missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield (0, adminController_1.addMaterialFromUrl)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 400 if scraping fails', () => __awaiter(void 0, void 0, void 0, function* () {
            scraperService_1.scraperService.scrapeProductPage.mockResolvedValue(null);
            const req = { body: { url: 'url', internalCode: 'C1', name: 'N1', category: 'C', unit: 'buc' } };
            const res = mockRes();
            yield (0, adminController_1.addMaterialFromUrl)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 400 if scraped price is 0 and not in stock', () => __awaiter(void 0, void 0, void 0, function* () {
            scraperService_1.scraperService.scrapeProductPage.mockResolvedValue({ price: 0, inStock: false });
            const req = { body: { url: 'url', internalCode: 'C1', name: 'N1', category: 'C', unit: 'buc' } };
            const res = mockRes();
            yield (0, adminController_1.addMaterialFromUrl)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('creates material and price history on success', () => __awaiter(void 0, void 0, void 0, function* () {
            scraperService_1.scraperService.scrapeProductPage.mockResolvedValue({ price: 100, inStock: true, stockQuantity: 50 });
            prisma_1.prisma.material.create.mockResolvedValue({ id: 1 });
            const req = { body: { url: 'url', internalCode: 'C1', name: 'N1', category: 'C', unit: 'buc' } };
            const res = mockRes();
            yield (0, adminController_1.addMaterialFromUrl)(req, res);
            expect(prisma_1.prisma.material.create).toHaveBeenCalled();
            expect(prisma_1.prisma.priceHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ materialId: 1, price: 100 }) }));
            expect(res.json).toHaveBeenCalledWith({ success: true, material: { id: 1 } });
        }));
        it('returns 500 on db error', () => __awaiter(void 0, void 0, void 0, function* () {
            scraperService_1.scraperService.scrapeProductPage.mockResolvedValue({ price: 100, inStock: true });
            prisma_1.prisma.material.create.mockRejectedValue(new Error('DB Error'));
            const req = { body: { url: 'url', internalCode: 'C1', name: 'N1', category: 'C', unit: 'buc' } };
            const res = mockRes();
            yield (0, adminController_1.addMaterialFromUrl)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('addMaterialManual', () => {
        it('returns 400 if required fields are missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { internalCode: 'C1' } };
            const res = mockRes();
            yield (0, adminController_1.addMaterialManual)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('creates material manually', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.material.create.mockResolvedValue({ id: 2 });
            const req = { body: { internalCode: 'C2', name: 'N2', category: 'C', unit: 'kg', pricePerUnit: 10 } };
            const res = mockRes();
            yield (0, adminController_1.addMaterialManual)(req, res);
            expect(prisma_1.prisma.material.create).toHaveBeenCalled();
            expect(prisma_1.prisma.priceHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ price: 10 }) }));
            expect(res.json).toHaveBeenCalledWith({ success: true, material: { id: 2 } });
        }));
        it('returns 500 on manual create error', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.material.create.mockRejectedValue(new Error('DB Error'));
            const req = { body: { internalCode: 'C2', name: 'N2', category: 'C', unit: 'kg', pricePerUnit: 10 } };
            const res = mockRes();
            yield (0, adminController_1.addMaterialManual)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('importMaterialsCsv', () => {
        it('returns 400 if no file provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = {};
            const res = mockRes();
            yield (0, adminController_1.importMaterialsCsv)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
    });
    describe('getters and mutators', () => {
        it('getUsers returns users list', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.user.findMany.mockResolvedValue([{ id: 1 }]);
            const req = {};
            const res = mockRes();
            yield (0, adminController_1.getUsers)(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, users: [{ id: 1 }] });
        }));
        it('getAllMaterials returns materials list', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.material.findMany.mockResolvedValue([{ id: 1 }]);
            const req = {};
            const res = mockRes();
            yield (0, adminController_1.getAllMaterials)(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, materials: [{ id: 1 }] });
        }));
        it('updateMaterial updates material', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.material.update.mockResolvedValue({ id: 1, name: 'Updated' });
            const req = { params: { id: '1' }, body: { name: 'Updated' } };
            const res = mockRes();
            yield (0, adminController_1.updateMaterial)(req, res);
            expect(prisma_1.prisma.material.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'Updated' } });
            expect(res.json).toHaveBeenCalledWith({ success: true, material: { id: 1, name: 'Updated' } });
        }));
        it('deleteMaterial deletes material', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: '1' } };
            const res = mockRes();
            yield (0, adminController_1.deleteMaterial)(req, res);
            expect(prisma_1.prisma.material.delete).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Material șters cu succes.' });
        }));
        it('returns 500 on getters or mutators error', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.user.findMany.mockRejectedValue(new Error('Err'));
            const req = {};
            const res = mockRes();
            yield (0, adminController_1.getUsers)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            prisma_1.prisma.material.findMany.mockRejectedValue(new Error('Err'));
            yield (0, adminController_1.getAllMaterials)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            prisma_1.prisma.material.update.mockRejectedValue(new Error('Err'));
            req.params = { id: '1' };
            yield (0, adminController_1.updateMaterial)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            prisma_1.prisma.material.delete.mockRejectedValue(new Error('Err'));
            yield (0, adminController_1.deleteMaterial)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
        it('reseedNormatives returns success', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = {};
            const res = mockRes();
            yield (0, adminController_1.reseedNormatives)(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        }));
    });
});
