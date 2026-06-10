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
exports.deleteProject = exports.updateProject = exports.getProjectById = exports.getUserProjects = exports.createProject = void 0;
const projectService_1 = require("./projectService");
// Creare Proiect nou
const createProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.user.id;
        const title = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.title) || `Proiect nou - ${new Date().toLocaleDateString()}`;
        const project = yield projectService_1.projectService.createProject(userId, title);
        res.status(201).json(project);
    }
    catch (error) {
        console.error('Eroare creare proiect:', error);
        res.status(500).json({ message: 'Eroare la crearea proiectului' });
    }
});
exports.createProject = createProject;
// Preluare proiecte user curent
const getUserProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projects = yield projectService_1.projectService.getUserProjects(req.user.id);
        res.json(projects);
    }
    catch (error) {
        console.error('Eroare preluare proiecte:', error);
        res.status(500).json({ message: 'Eroare la preluarea proiectelor' });
    }
});
exports.getUserProjects = getUserProjects;
// Preluare proiect după ID
// tenantGuard a verificat ownership și a atașat proiectul la req.project
const getProjectById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // tenantGuard garantează că req.project este întotdeauna populat pe această rută
    res.json(req.project);
});
exports.getProjectById = getProjectById;
// Actualizare proiect
// tenantGuard a verificat ownership înainte de apelul acestui controller
const updateProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.id);
        const updatedProject = yield projectService_1.projectService.updateProject(projectId, req.body, req.project);
        res.status(200).json(updatedProject);
    }
    catch (error) {
        if (error.message === 'NOT_FOUND') {
            res.status(404).json({ message: 'Proiectul nu a fost găsit' });
        }
        else {
            console.error('Eroare la actualizare proiect:', error);
            res.status(500).json({ message: 'Eroare la actualizarea proiectului' });
        }
    }
});
exports.updateProject = updateProject;
// Ștergere proiect
// tenantGuard a verificat ownership înainte de apelul acestui controller
const deleteProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.id);
        yield projectService_1.projectService.deleteProject(projectId);
        res.status(200).json({ message: 'Proiect șters cu succes' });
    }
    catch (error) {
        console.error('Eroare ștergere proiect:', error);
        res.status(500).json({ message: 'Eroare la ștergerea proiectului' });
    }
});
exports.deleteProject = deleteProject;
