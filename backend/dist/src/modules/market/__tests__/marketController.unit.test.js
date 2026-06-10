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
const marketController_1 = require("../marketController");
const prisma_1 = require("../../../lib/prisma");
const marketService_1 = require("../marketService");
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
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}
describe('marketController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('publishProject', () => {
        it('returns 400 if projectId is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: 'abc' } };
            const res = mockRes();
            yield (0, marketController_1.publishProject)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 404 if project not found', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.project.findUnique.mockResolvedValue(null);
            const req = { params: { id: '1' } };
            const res = mockRes();
            yield (0, marketController_1.publishProject)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('returns 403 if user not owner', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.project.findUnique.mockResolvedValue({ userId: 2 });
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.publishProject)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('publishes project', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.project.findUnique.mockResolvedValue({ userId: 1 });
            prisma_1.prisma.project.update.mockResolvedValue({ isPublishedForBidding: true });
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.publishProject)(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.project.findUnique.mockRejectedValue(new Error('err'));
            const req = { params: { id: '1' } };
            const res = mockRes();
            yield (0, marketController_1.publishProject)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getFeed', () => {
        it('returns 401 if user missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = {};
            const res = mockRes();
            yield (0, marketController_1.getFeed)(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        }));
        it('returns 403 if not contractor', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorProfile.findUnique.mockResolvedValue(null);
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.getFeed)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('returns feed masking data for unverified contractor', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorProfile.findUnique.mockResolvedValue({ isVerified: false });
            prisma_1.prisma.project.findMany.mockResolvedValue([{ user: { name: 'A', email: 'E', phone: '123' } }]);
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.getFeed)(req, res);
            expect(res.json).toHaveBeenCalledWith({
                isVerified: false,
                projects: [{ user: { name: 'A', email: 'E', phone: '*** (Cont Neverificat)' } }]
            });
        }));
        it('returns full feed for verified contractor', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorProfile.findUnique.mockResolvedValue({ isVerified: true });
            prisma_1.prisma.project.findMany.mockResolvedValue([{ user: { phone: '123' } }]);
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.getFeed)(req, res);
            expect(res.json).toHaveBeenCalledWith({
                isVerified: true,
                projects: [{ user: { phone: '123' } }]
            });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorProfile.findUnique.mockRejectedValue(new Error('err'));
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.getFeed)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('submitQuote', () => {
        it('returns 400 for invalid data', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: 'a' }, body: {}, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.submitQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 403 if not contractor', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorProfile.findUnique.mockResolvedValue(null);
            const req = { params: { id: '1' }, body: { selectedPhases: [] }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.submitQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('returns 403 if unverified', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorProfile.findUnique.mockResolvedValue({ isVerified: false });
            const req = { params: { id: '1' }, body: { selectedPhases: [] }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.submitQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('submits quote', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorProfile.findUnique.mockResolvedValue({ id: 10, isVerified: true });
            prisma_1.prisma.contractorQuote.upsert.mockResolvedValue({ id: 20 });
            const req = { params: { id: '1' }, body: { selectedPhases: [1, 2] }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.submitQuote)(req, res);
            expect(prisma_1.prisma.contractorQuote.upsert).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ quote: { id: 20 } }));
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorProfile.findUnique.mockRejectedValue(new Error('err'));
            const req = { params: { id: '1' }, body: { selectedPhases: [1] }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.submitQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getProjectQuotes', () => {
        it('returns 400 if invalid input', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: 'abc' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.getProjectQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 403 if not project owner', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.project.findUnique.mockResolvedValue({ userId: 2 });
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.getProjectQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('returns quotes', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.project.findUnique.mockResolvedValue({ userId: 1 });
            prisma_1.prisma.contractorQuote.findMany.mockResolvedValue([{ id: 10 }]);
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.getProjectQuotes)(req, res);
            expect(res.json).toHaveBeenCalledWith([{ id: 10 }]);
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.project.findUnique.mockRejectedValue(new Error('err'));
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.getProjectQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('acceptQuote', () => {
        it('returns 400 for invalid data', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { quoteId: 'abc' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.acceptQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 403 if access denied', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorQuote.findUnique.mockResolvedValue({ project: { userId: 2 } });
            const req = { params: { quoteId: '10' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.acceptQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('accepts quote and updates phases', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorQuote.findUnique.mockResolvedValue({
                id: 10, projectId: 1, contractorId: 5, project: { userId: 1 }, phases: [{ id: 100 }]
            });
            const req = { params: { quoteId: '10' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.acceptQuote)(req, res);
            expect(prisma_1.prisma.contractorQuote.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { status: 'ACCEPTED' } });
            expect(prisma_1.prisma.constructionPhase.updateMany).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ message: 'Ofertă acceptată cu succes.' });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorQuote.findUnique.mockRejectedValue(new Error('err'));
            const req = { params: { quoteId: '10' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.acceptQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('rejectQuote', () => {
        it('returns 400 for invalid data', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { quoteId: 'abc' }, body: {}, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.rejectQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 403 if access denied', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorQuote.findUnique.mockResolvedValue({ project: { userId: 2 } });
            const req = { params: { quoteId: '10' }, body: {}, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.rejectQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('rejects quote', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorQuote.findUnique.mockResolvedValue({
                id: 10, project: { userId: 1 }
            });
            const req = { params: { quoteId: '10' }, user: { id: 1 }, body: { clientMessage: 'Nu' } };
            const res = mockRes();
            yield (0, marketController_1.rejectQuote)(req, res);
            expect(prisma_1.prisma.contractorQuote.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { status: 'REJECTED', clientMessage: 'Nu' } });
            expect(res.json).toHaveBeenCalledWith({ message: 'Ofertă refuzată cu succes.' });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            prisma_1.prisma.contractorQuote.findUnique.mockRejectedValue(new Error('err'));
            const req = { params: { quoteId: '10' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, marketController_1.rejectQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('Market Service APIs', () => {
        it('getHistory', () => __awaiter(void 0, void 0, void 0, function* () {
            marketService_1.marketService.getIndexHistory.mockResolvedValue([]);
            const res = mockRes();
            yield (0, marketController_1.getHistory)({}, res);
            expect(res.json).toHaveBeenCalledWith({ data: [] });
        }));
        it('getForecast', () => __awaiter(void 0, void 0, void 0, function* () {
            marketService_1.marketService.getForecast.mockResolvedValue([]);
            const res = mockRes();
            yield (0, marketController_1.getForecast)({}, res);
            expect(res.json).toHaveBeenCalledWith([]);
        }));
        it('getSummary', () => __awaiter(void 0, void 0, void 0, function* () {
            marketService_1.marketService.getSummary.mockResolvedValue({});
            const res = mockRes();
            yield (0, marketController_1.getSummary)({}, res);
            expect(res.json).toHaveBeenCalledWith({});
        }));
        it('returns 500 on errors', () => __awaiter(void 0, void 0, void 0, function* () {
            marketService_1.marketService.getSummary.mockRejectedValue(new Error('err'));
            const res = mockRes();
            yield (0, marketController_1.getSummary)({}, res);
            expect(res.status).toHaveBeenCalledWith(500);
            marketService_1.marketService.getIndexHistory.mockRejectedValue(new Error('err'));
            const res2 = mockRes();
            yield (0, marketController_1.getHistory)({}, res2);
            expect(res2.status).toHaveBeenCalledWith(500);
            marketService_1.marketService.getForecast.mockRejectedValue(new Error('err'));
            const res3 = mockRes();
            yield (0, marketController_1.getForecast)({}, res3);
            expect(res3.status).toHaveBeenCalledWith(500);
        }));
    });
});
