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
exports.exportController = void 0;
const exportService_1 = require("./exportService");
exports.exportController = {
    generatePlanPdf(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectId = parseInt(req.params['projectId']);
            const { planPngBase64 } = req.body;
            if (isNaN(projectId)) {
                res.status(400).json({ error: 'projectId invalid' });
                return;
            }
            try {
                const result = yield exportService_1.exportService.generatePlanPdf(projectId, planPngBase64 !== null && planPngBase64 !== void 0 ? planPngBase64 : null);
                if (!result) {
                    res.status(404).json({
                        error: 'Nu există snapshot publicat pentru acest proiect. Publică mai întâi o versiune a planului.',
                    });
                    return;
                }
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                res.setHeader('Content-Length', result.buffer.length);
                res.send(result.buffer);
            }
            catch (err) {
                console.error('[exportController] Eroare la generarea PDF:', err);
                res.status(500).json({ error: 'Eroare la generarea PDF. Încearcă din nou.' });
            }
        });
    },
    generateContractorPdf(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const quoteId = parseInt(req.params['quoteId']);
            const contractorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const { planPngBase64 } = req.body;
            if (isNaN(quoteId)) {
                res.status(400).json({ error: 'quoteId invalid' });
                return;
            }
            try {
                const result = yield exportService_1.exportService.generateContractorPdf(quoteId, contractorId, planPngBase64 !== null && planPngBase64 !== void 0 ? planPngBase64 : null);
                if (!result) {
                    res.status(404).json({
                        error: 'Ofertă inexistentă sau neautorizată, ori lipsesc date pentru export.',
                    });
                    return;
                }
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                res.setHeader('Content-Length', result.buffer.length);
                res.send(result.buffer);
            }
            catch (err) {
                console.error('[exportController] Eroare la generarea PDF contractor:', err);
                res.status(500).json({ error: 'Eroare la generarea PDF. Încearcă din nou.' });
            }
        });
    }
};
