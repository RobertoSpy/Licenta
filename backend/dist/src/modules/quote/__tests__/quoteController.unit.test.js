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
const quoteController_1 = require("../quoteController");
const quoteService_1 = require("../quoteService");
jest.mock('../quoteService');
describe('Quote Controller Unit Tests', () => {
    let req;
    let res;
    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            user: { id: 100, role: 'CLIENT' }
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
    });
    describe('requestQuotes', () => {
        it('returns 400 when request body fails validation (missing contractorIds)', () => __awaiter(void 0, void 0, void 0, function* () {
            req.body = { projectId: 1 };
            yield (0, quoteController_1.requestQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('invalide') }));
        }));
        it('returns 201 Created and success message when new quotes are requested', () => __awaiter(void 0, void 0, void 0, function* () {
            req.body = { projectId: 1, contractorIds: [10, 11] };
            quoteService_1.quoteService.requestQuotes.mockResolvedValue({ count: 2 });
            yield (0, quoteController_1.requestQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ count: 2, message: 'Cereri trimise cu succes.' });
        }));
        it('returns 200 without message when count is 0', () => __awaiter(void 0, void 0, void 0, function* () {
            req.body = { projectId: 1, contractorIds: [10] };
            quoteService_1.quoteService.requestQuotes.mockResolvedValue({ count: 0, message: 'Deja trimis' });
            yield (0, quoteController_1.requestQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ count: 0, message: 'Deja trimis' });
        }));
        it('maps Unauthorized error to 403', () => __awaiter(void 0, void 0, void 0, function* () {
            req.body = { projectId: 1, contractorIds: [10] };
            quoteService_1.quoteService.requestQuotes.mockRejectedValue(new Error('Unauthorized'));
            yield (0, quoteController_1.requestQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: 'Acțiune nepermisă' });
        }));
        it('maps generic Error to 500 without exposing stack trace', () => __awaiter(void 0, void 0, void 0, function* () {
            req.body = { projectId: 1, contractorIds: [10] };
            quoteService_1.quoteService.requestQuotes.mockRejectedValue(new Error('Some DB explosion'));
            yield (0, quoteController_1.requestQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: 'Eroare la trimiterea cererii de ofertă' });
        }));
    });
    describe('getClientQuotes', () => {
        it('returns 403 on Unauthorized', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { projectId: '1' };
            quoteService_1.quoteService.getQuotesForClient.mockRejectedValue(new Error('Unauthorized'));
            yield (0, quoteController_1.getClientQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('returns 404 on Project not found', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { projectId: '1' };
            quoteService_1.quoteService.getQuotesForClient.mockRejectedValue(new Error('Project not found'));
            yield (0, quoteController_1.getClientQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Proiectul nu a fost găsit' });
        }));
        it('returns quotes with 200 (implicit)', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { projectId: '1' };
            quoteService_1.quoteService.getQuotesForClient.mockResolvedValue([{ id: 1 }]);
            yield (0, quoteController_1.getClientQuotes)(req, res);
            expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
        }));
        it('returns 500 on generic error', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { projectId: '1' };
            quoteService_1.quoteService.getQuotesForClient.mockRejectedValue(new Error('err'));
            yield (0, quoteController_1.getClientQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getContractorQuotes', () => {
        it('maps Contractor profile not found to 404', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.getQuotesForContractor.mockRejectedValue(new Error('Contractor profile not found'));
            yield (0, quoteController_1.getContractorQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Profilul de constructor nu a fost găsit' });
        }));
        it('returns 500 on generic error', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.getQuotesForContractor.mockRejectedValue(new Error('Database err'));
            yield (0, quoteController_1.getContractorQuotes)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('submitQuote', () => {
        beforeEach(() => {
            req.params = { id: '1' };
            req.body = { totalAmount: 100 };
        });
        it('maps Unauthorized to 403', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.submitQuote.mockRejectedValue(new Error('Unauthorized'));
            yield (0, quoteController_1.submitQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('maps not found to 404', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.submitQuote.mockRejectedValue(new Error('Quote not found'));
            yield (0, quoteController_1.submitQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('maps Validation to 400', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.submitQuote.mockRejectedValue(new Error('Validation: amount required'));
            yield (0, quoteController_1.submitQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Validation: amount required' });
        }));
        it('returns success', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.submitQuote.mockResolvedValue({ id: 1, status: 'SENT' });
            yield (0, quoteController_1.submitQuote)(req, res);
            expect(res.json).toHaveBeenCalledWith({ id: 1, status: 'SENT' });
        }));
        it('returns 500 on generic error', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.submitQuote.mockRejectedValue(new Error('err'));
            yield (0, quoteController_1.submitQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('acceptQuote', () => {
        beforeEach(() => {
            req.params = { id: '1' };
        });
        it('maps Unauthorized to 403', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.acceptQuote.mockRejectedValue(new Error('Unauthorized'));
            yield (0, quoteController_1.acceptQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('maps not found to 404', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.acceptQuote.mockRejectedValue(new Error('Quote not found'));
            yield (0, quoteController_1.acceptQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('returns success', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.acceptQuote.mockResolvedValue({ id: 1, status: 'ACCEPTED' });
            yield (0, quoteController_1.acceptQuote)(req, res);
            expect(res.json).toHaveBeenCalledWith({ id: 1, status: 'ACCEPTED' });
        }));
        it('returns 500 on generic error', () => __awaiter(void 0, void 0, void 0, function* () {
            quoteService_1.quoteService.acceptQuote.mockRejectedValue(new Error('err'));
            yield (0, quoteController_1.acceptQuote)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
});
