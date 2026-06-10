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
const projectController_1 = require("../projectController");
const projectService_1 = require("../projectService");
jest.mock('../projectService');
describe('Project Controller', () => {
    let req;
    let res;
    let jsonMock;
    let statusMock;
    let consoleSpy;
    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        req = {
            user: { id: 1, role: 'CLIENT' },
            body: {},
            params: {}
        };
        res = {
            status: statusMock,
            json: jsonMock,
        };
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });
    afterEach(() => {
        consoleSpy.mockRestore();
    });
    describe('createProject', () => {
        it('returns 201 and created project', () => __awaiter(void 0, void 0, void 0, function* () {
            req.body = { title: 'Test' };
            projectService_1.projectService.createProject.mockResolvedValue({ id: 1, title: 'Test' });
            yield (0, projectController_1.createProject)(req, res);
            expect(statusMock).toHaveBeenCalledWith(201);
            expect(jsonMock).toHaveBeenCalledWith({ id: 1, title: 'Test' });
            expect(projectService_1.projectService.createProject).toHaveBeenCalledWith(1, 'Test');
        }));
        it('returns 201 with default title if missing', () => __awaiter(void 0, void 0, void 0, function* () {
            projectService_1.projectService.createProject.mockResolvedValue({ id: 1 });
            yield (0, projectController_1.createProject)(req, res);
            expect(statusMock).toHaveBeenCalledWith(201);
            expect(projectService_1.projectService.createProject).toHaveBeenCalledWith(1, expect.stringContaining('Proiect nou -'));
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            projectService_1.projectService.createProject.mockRejectedValue(new Error('DB Error'));
            yield (0, projectController_1.createProject)(req, res);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Eroare la crearea proiectului' });
        }));
    });
    describe('getUserProjects', () => {
        it('returns 200 and projects list', () => __awaiter(void 0, void 0, void 0, function* () {
            projectService_1.projectService.getUserProjects.mockResolvedValue([{ id: 1 }]);
            yield (0, projectController_1.getUserProjects)(req, res);
            expect(jsonMock).toHaveBeenCalledWith([{ id: 1 }]);
            expect(projectService_1.projectService.getUserProjects).toHaveBeenCalledWith(1);
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            projectService_1.projectService.getUserProjects.mockRejectedValue(new Error('DB Error'));
            yield (0, projectController_1.getUserProjects)(req, res);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Eroare la preluarea proiectelor' });
        }));
    });
    describe('getProjectById', () => {
        it('returns 200 and project attached by tenantGuard', () => __awaiter(void 0, void 0, void 0, function* () {
            req.project = { id: 1, title: 'Test' };
            yield (0, projectController_1.getProjectById)(req, res);
            expect(jsonMock).toHaveBeenCalledWith({ id: 1, title: 'Test' });
        }));
    });
    describe('updateProject', () => {
        it('returns 200 and updated project', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { id: '1' };
            req.body = { title: 'Updated' };
            req.project = { id: 1 };
            projectService_1.projectService.updateProject.mockResolvedValue({ id: 1, title: 'Updated' });
            yield (0, projectController_1.updateProject)(req, res);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ id: 1, title: 'Updated' });
            expect(projectService_1.projectService.updateProject).toHaveBeenCalledWith(1, { title: 'Updated' }, { id: 1 });
        }));
        it('returns 404 when NOT_FOUND thrown', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { id: '1' };
            projectService_1.projectService.updateProject.mockRejectedValue(new Error('NOT_FOUND'));
            yield (0, projectController_1.updateProject)(req, res);
            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Proiectul nu a fost găsit' });
        }));
        it('returns 500 on other errors', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { id: '1' };
            projectService_1.projectService.updateProject.mockRejectedValue(new Error('DB Error'));
            yield (0, projectController_1.updateProject)(req, res);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Eroare la actualizarea proiectului' });
        }));
    });
    describe('deleteProject', () => {
        it('returns 200 on success', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { id: '1' };
            projectService_1.projectService.deleteProject.mockResolvedValue(undefined);
            yield (0, projectController_1.deleteProject)(req, res);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Proiect șters cu succes' });
            expect(projectService_1.projectService.deleteProject).toHaveBeenCalledWith(1);
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = { id: '1' };
            projectService_1.projectService.deleteProject.mockRejectedValue(new Error('DB Error'));
            yield (0, projectController_1.deleteProject)(req, res);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Eroare la ștergerea proiectului' });
        }));
    });
});
