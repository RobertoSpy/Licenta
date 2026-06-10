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
const constructionController_1 = require("../constructionController");
const constructionService_1 = require("../constructionService");
jest.mock('../constructionService');
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}
describe('constructionController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getPhases', () => {
        it('returns 400 if projectId is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: 'abc' } };
            const res = mockRes();
            yield (0, constructionController_1.getPhases)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 400 if project has no published snapshot', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1' }, project: { publishedSnapshotId: null } };
            const res = mockRes();
            yield (0, constructionController_1.getPhases)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 500 if MISSING_JSON_FILE', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1' }, project: { publishedSnapshotId: 10 } };
            const res = mockRes();
            constructionService_1.constructionService.getProjectPhases.mockRejectedValue(new Error('MISSING_JSON_FILE'));
            yield (0, constructionController_1.getPhases)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Eroare la configuratia fazelor' });
        }));
        it('returns 500 for generic error', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1' }, project: { publishedSnapshotId: 10 } };
            const res = mockRes();
            constructionService_1.constructionService.getProjectPhases.mockRejectedValue(new Error('OTHER_ERROR'));
            yield (0, constructionController_1.getPhases)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Eroare la preluare etape' });
        }));
        it('returns phases on success', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1' }, project: { publishedSnapshotId: 10 } };
            const res = mockRes();
            constructionService_1.constructionService.getProjectPhases.mockResolvedValue([{ id: 1 }]);
            yield (0, constructionController_1.getPhases)(req, res);
            expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
        }));
    });
    describe('completePhase', () => {
        it('returns 400 for invalid params', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: 'a', phaseOrder: '0' } };
            const res = mockRes();
            yield (0, constructionController_1.completePhase)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 404 if PHASE_NOT_FOUND', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1', phaseOrder: '5' } };
            const res = mockRes();
            constructionService_1.constructionService.completePhase.mockRejectedValue(new Error('PHASE_NOT_FOUND'));
            yield (0, constructionController_1.completePhase)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('returns 409 if PREREQUISITE_NOT_COMPLETED', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1', phaseOrder: '5' } };
            const res = mockRes();
            constructionService_1.constructionService.completePhase.mockRejectedValue(new Error('PREREQUISITE_NOT_COMPLETED'));
            yield (0, constructionController_1.completePhase)(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
        }));
        it('returns 500 for generic error', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1', phaseOrder: '5' } };
            const res = mockRes();
            constructionService_1.constructionService.completePhase.mockRejectedValue(new Error('OTHER_ERROR'));
            yield (0, constructionController_1.completePhase)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
        it('returns updated on success', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1', phaseOrder: '5' } };
            const res = mockRes();
            constructionService_1.constructionService.completePhase.mockResolvedValue({ id: 5 });
            yield (0, constructionController_1.completePhase)(req, res);
            expect(res.json).toHaveBeenCalledWith({ id: 5 });
        }));
    });
});
