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
exports.completePhase = exports.getPhases = void 0;
const constructionService_1 = require("./constructionService");
const getPhases = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ error: 'ID proiect invalid' });
            return;
        }
        if (!((_a = req.project) === null || _a === void 0 ? void 0 : _a.publishedSnapshotId)) {
            res.status(400).json({ error: 'Proiectul nu are un plan publicat' });
            return;
        }
        const phases = yield constructionService_1.constructionService.getProjectPhases(projectId);
        res.json(phases);
    }
    catch (error) {
        if (error.message === 'MISSING_JSON_FILE' || error.message === 'MALFORMED_JSON_FILE') {
            res.status(500).json({ error: 'Eroare la configuratia fazelor' });
            return;
        }
        console.error('[ConstructionController] Eroare la preluare etape:', error);
        res.status(500).json({ error: 'Eroare la preluare etape' });
    }
});
exports.getPhases = getPhases;
const completePhase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        const phaseOrder = parseInt(req.params.phaseOrder, 10);
        if (isNaN(projectId) || isNaN(phaseOrder) || phaseOrder < 1) {
            res.status(400).json({ error: 'Parametri invalizi' });
            return;
        }
        const updated = yield constructionService_1.constructionService.completePhase(projectId, phaseOrder);
        res.json(updated);
    }
    catch (error) {
        if (error.message === 'PHASE_NOT_FOUND') {
            res.status(404).json({ error: 'Faza nu exista' });
            return;
        }
        if (error.message === 'PREREQUISITE_NOT_COMPLETED') {
            res.status(409).json({ error: 'Faza anterioara nu este completata' });
            return;
        }
        console.error('[ConstructionController] Eroare la completare etapa:', error);
        res.status(500).json({ error: 'Eroare la completare etapa' });
    }
});
exports.completePhase = completePhase;
