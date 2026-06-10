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
const tenantGuard_1 = require("../tenantGuard");
const projectRepository_1 = require("../../../modules/project/projectRepository");
jest.mock('../../../modules/project/projectRepository');
describe('tenantGuard (unit)', () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = { params: {}, body: {}, user: { id: 1 } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });
    it('returns 400 when projectId param is present but non-numeric (NaN after parseInt)', () => __awaiter(void 0, void 0, void 0, function* () {
        req.params.projectId = 'abc';
        yield (0, tenantGuard_1.tenantGuard)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'ID proiect invalid sau lipsă.' });
        expect(next).not.toHaveBeenCalled();
    }));
    it('does not make DB call when projectId is NaN (fails fast)', () => __awaiter(void 0, void 0, void 0, function* () {
        req.params.id = 'invalid';
        yield (0, tenantGuard_1.tenantGuard)(req, res, next);
        expect(projectRepository_1.projectRepository.findById).not.toHaveBeenCalled();
    }));
    it('returns 403, not 404, when project exists but belongs to different user', () => __awaiter(void 0, void 0, void 0, function* () {
        req.params.projectId = '100';
        req.user.id = 1;
        // Mock returnează un proiect valid dar cu userId diferit
        projectRepository_1.projectRepository.findById.mockResolvedValue({ id: 100, userId: 999, title: 'Secret Project' });
        yield (0, tenantGuard_1.tenantGuard)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.status).not.toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
    }));
    it('sets req.project with full project object, not just id', () => __awaiter(void 0, void 0, void 0, function* () {
        req.params.projectId = '100';
        req.user.id = 1;
        const mockProject = { id: 100, userId: 1, title: 'My Project', description: 'Desc' };
        projectRepository_1.projectRepository.findById.mockResolvedValue(mockProject);
        yield (0, tenantGuard_1.tenantGuard)(req, res, next);
        expect(req.project).toEqual(mockProject);
        expect(next).toHaveBeenCalledTimes(1);
    }));
    it('works correctly when req.user is set by authMiddleware (dependency order)', () => __awaiter(void 0, void 0, void 0, function* () {
        // Simulăm fix flow-ul unde authMiddleware a populat req.user
        req.user = { id: 42, role: 'CLIENT' };
        req.params.id = '100';
        const mockProject = { id: 100, userId: 42, title: 'My Project' };
        projectRepository_1.projectRepository.findById.mockResolvedValue(mockProject);
        yield (0, tenantGuard_1.tenantGuard)(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    }));
});
