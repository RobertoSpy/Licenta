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
const contractorController_1 = require("../contractorController");
const contractorService_1 = require("../contractorService");
jest.mock('../contractorService');
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}
describe('contractorController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getContractors', () => {
        it('returns contractors list', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getContractors.mockResolvedValue([{ id: 1 }]);
            const req = { query: { county: 'B', specializations: 'Zidarie,Acoperis' } };
            const res = mockRes();
            yield (0, contractorController_1.getContractors)(req, res);
            expect(contractorService_1.contractorService.getContractors).toHaveBeenCalledWith('B', ['Zidarie', 'Acoperis']);
            expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
        }));
        it('handles errors', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getContractors.mockRejectedValue(new Error('error'));
            const req = { query: {} };
            const res = mockRes();
            yield (0, contractorController_1.getContractors)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getContractorById', () => {
        it('returns 400 for invalid ID', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: 'abc' } };
            const res = mockRes();
            yield (0, contractorController_1.getContractorById)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 404 if not found', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getContractorById.mockResolvedValue(null);
            const req = { params: { id: '1' } };
            const res = mockRes();
            yield (0, contractorController_1.getContractorById)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('returns contractor on success', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getContractorById.mockResolvedValue({ id: 1 });
            const req = { params: { id: '1' } };
            const res = mockRes();
            yield (0, contractorController_1.getContractorById)(req, res);
            expect(res.json).toHaveBeenCalledWith({ id: 1 });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getContractorById.mockRejectedValue(new Error('err'));
            const req = { params: { id: '1' } };
            const res = mockRes();
            yield (0, contractorController_1.getContractorById)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getMyProfile', () => {
        it('returns 404 if not found', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getProfileByUserId.mockResolvedValue(null);
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, contractorController_1.getMyProfile)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('returns profile', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getProfileByUserId.mockResolvedValue({ id: 1 });
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, contractorController_1.getMyProfile)(req, res);
            expect(res.json).toHaveBeenCalledWith({ id: 1 });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getProfileByUserId.mockRejectedValue(new Error('err'));
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, contractorController_1.getMyProfile)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('updateMyProfile', () => {
        it('updates and returns profile', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.updateProfile.mockResolvedValue({ id: 1, name: 'X' });
            const req = { user: { id: 1 }, body: { name: 'X' } };
            const res = mockRes();
            yield (0, contractorController_1.updateMyProfile)(req, res);
            expect(contractorService_1.contractorService.updateProfile).toHaveBeenCalledWith(1, { name: 'X' });
            expect(res.json).toHaveBeenCalledWith({ id: 1, name: 'X' });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.updateProfile.mockRejectedValue(new Error('err'));
            const req = { user: { id: 1 }, body: { name: 'X' } };
            const res = mockRes();
            yield (0, contractorController_1.updateMyProfile)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('addReview', () => {
        it('returns 400 for invalid ID', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { user: { id: 1 }, params: { id: 'a' } };
            const res = mockRes();
            yield (0, contractorController_1.addReview)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 400 for invalid rating', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { user: { id: 1 }, params: { id: '1' }, body: { rating: 6, comment: 'test', projectId: '2' } };
            const res = mockRes();
            yield (0, contractorController_1.addReview)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 400 for invalid comment', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: '', projectId: '2' } };
            const res = mockRes();
            yield (0, contractorController_1.addReview)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 403 if NOT_AUTHORIZED', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.addReview.mockRejectedValue(new Error('NOT_AUTHORIZED_OR_NO_ACCEPTED_QUOTE'));
            const req = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: 'test', projectId: '2' } };
            const res = mockRes();
            yield (0, contractorController_1.addReview)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('returns 409 if ALREADY_REVIEWED', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.addReview.mockRejectedValue(new Error('ALREADY_REVIEWED'));
            const req = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: 'test', projectId: '2' } };
            const res = mockRes();
            yield (0, contractorController_1.addReview)(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
        }));
        it('adds review successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.addReview.mockResolvedValue({ id: 10 });
            const req = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: 'test', projectId: '2' } };
            const res = mockRes();
            yield (0, contractorController_1.addReview)(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, review: { id: 10 } });
        }));
        it('returns 500 on generic error', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.addReview.mockRejectedValue(new Error('err'));
            const req = { user: { id: 1 }, params: { id: '1' }, body: { rating: 5, comment: 'test', projectId: '2' } };
            const res = mockRes();
            yield (0, contractorController_1.addReview)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getAcceptedProjects', () => {
        it('returns projects', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getAcceptedProjects.mockResolvedValue([{ id: 1 }]);
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, contractorController_1.getAcceptedProjects)(req, res);
            expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            contractorService_1.contractorService.getAcceptedProjects.mockRejectedValue(new Error('err'));
            const req = { user: { id: 1 } };
            const res = mockRes();
            yield (0, contractorController_1.getAcceptedProjects)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
});
