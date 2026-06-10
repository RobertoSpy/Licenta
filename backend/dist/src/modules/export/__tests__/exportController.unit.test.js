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
const exportController_1 = require("../exportController");
const exportService_1 = require("../exportService");
jest.mock('../exportService');
describe('exportController (unit)', () => {
    let req;
    let res;
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
        it('returns 400 for invalid projectId', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.projectId = 'abc';
            yield exportController_1.exportController.generatePlanPdf(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'projectId invalid' });
        }));
        it('returns 404 if exportService returns null', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.projectId = '1';
            exportService_1.exportService.generatePlanPdf.mockResolvedValue(null);
            yield exportController_1.exportController.generatePlanPdf(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('Content-Disposition header contains slugified project title, not raw title', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.projectId = '1';
            const fakeBuffer = Buffer.from('PDF Content');
            exportService_1.exportService.generatePlanPdf.mockResolvedValue({
                filename: 'plan-parter-casa-mea-v1.pdf',
                buffer: fakeBuffer
            });
            yield exportController_1.exportController.generatePlanPdf(req, res);
            expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="plan-parter-casa-mea-v1.pdf"');
        }));
        it('Content-Length matches actual buffer size', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.projectId = '1';
            const fakeBuffer = Buffer.from('12345');
            exportService_1.exportService.generatePlanPdf.mockResolvedValue({ filename: 'file.pdf', buffer: fakeBuffer });
            yield exportController_1.exportController.generatePlanPdf(req, res);
            expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 5);
        }));
        it('Content-Type is exactly "application/pdf", not "application/pdf; charset=utf-8"', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.projectId = '1';
            exportService_1.exportService.generatePlanPdf.mockResolvedValue({ filename: 'file.pdf', buffer: Buffer.from('') });
            yield exportController_1.exportController.generatePlanPdf(req, res);
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.projectId = '1';
            exportService_1.exportService.generatePlanPdf.mockRejectedValue(new Error('err'));
            yield exportController_1.exportController.generatePlanPdf(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('generateContractorPdf', () => {
        it('returns 400 for invalid quoteId', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.quoteId = 'abc';
            yield exportController_1.exportController.generateContractorPdf(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 404 if exportService returns null', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.quoteId = '1';
            req.user = { id: 2 };
            exportService_1.exportService.generateContractorPdf.mockResolvedValue(null);
            yield exportController_1.exportController.generateContractorPdf(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('returns pdf buffer successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.quoteId = '1';
            req.user = { id: 2 };
            req.body.planPngBase64 = 'b64';
            const fakeBuffer = Buffer.from('PDF Content');
            exportService_1.exportService.generateContractorPdf.mockResolvedValue({
                filename: 'contractor.pdf',
                buffer: fakeBuffer
            });
            yield exportController_1.exportController.generateContractorPdf(req, res);
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="contractor.pdf"');
            expect(res.send).toHaveBeenCalledWith(fakeBuffer);
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params.quoteId = '1';
            exportService_1.exportService.generateContractorPdf.mockRejectedValue(new Error('err'));
            yield exportController_1.exportController.generateContractorPdf(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
});
