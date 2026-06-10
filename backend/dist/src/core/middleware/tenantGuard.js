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
exports.tenantGuard = void 0;
const projectRepository_1 = require("../../modules/project/projectRepository");
/**
 * Middleware de izolare tenant (Row-Level Security la nivel de aplicație).
 *
 * Verifică că proiectul din request (params sau body) aparține
 * utilizatorului autentificat curent. Dacă verificarea trece,
 * atașează proiectul la req.project pentru a evita un query duplicat
 * în controller sau service.
 *
 * Utilizare:
 *  - router.get('/:id', protect, tenantGuard, controller)
 *  - router.post('/summary', protect, tenantGuard, controller)
 *
 * Extrage projectId din (în ordine): req.params.id, req.params.projectId, req.body.projectId
 */
const tenantGuard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const rawId = (_b = (_a = req.params.id) !== null && _a !== void 0 ? _a : req.params.projectId) !== null && _b !== void 0 ? _b : (_c = req.body) === null || _c === void 0 ? void 0 : _c.projectId;
    const projectId = parseInt(rawId);
    if (isNaN(projectId)) {
        res.status(400).json({ message: 'ID proiect invalid sau lipsă.' });
        return;
    }
    const project = yield projectRepository_1.projectRepository.findById(projectId);
    if (!project) {
        res.status(404).json({ message: 'Proiect negăsit.' });
        return;
    }
    if (project.userId !== ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id)) {
        // Excepție: Constructorii pot accesa proiectele (ex: pentru PDF-uri) dacă acestea sunt publicate pe marketplace
        if (((_e = req.user) === null || _e === void 0 ? void 0 : _e.role) === 'CONTRACTOR' && project.isPublishedForBidding) {
            // Permite accesul
        }
        else {
            res.status(403).json({ message: 'Acces interzis.' });
            return;
        }
    }
    // Atașăm proiectul verificat la request — controllere aval nu mai fac query duplicat
    req.project = project;
    next();
});
exports.tenantGuard = tenantGuard;
