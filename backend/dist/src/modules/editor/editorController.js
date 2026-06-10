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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateConfiguratorLayout = exports.generateLayout = exports.explainConformity = exports.validateConformity = exports.deleteSnapshot = exports.publishLatestSnapshot = exports.publishSnapshot = exports.getLatestSnapshot = exports.getSnapshot = exports.listSnapshots = exports.createSnapshot = void 0;
const editorService_1 = require("./editorService");
const agentOrchestrator_1 = require("../ai/services/agentOrchestrator");
const conformityService_1 = require("../../core/services/conformityService");
/**
 * POST /api/editor/snapshots
 * Body: { projectId, planJSON, label? }
 * Creare snapshot nou (auto-save sau manual Ctrl+S).
 */
const createSnapshot = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.body.projectId);
        const { planJSON, floor, label } = req.body;
        if (isNaN(projectId) || !planJSON) {
            res.status(400).json({ message: 'projectId valid și planJSON sunt obligatorii.' });
            return;
        }
        const validFloors = ['parter', 'etaj1'];
        const safeFloor = validFloors.includes(floor) ? floor : 'parter';
        const snapshot = yield editorService_1.editorService.saveSnapshot(projectId, planJSON, safeFloor, label);
        res.status(201).json(snapshot);
    }
    catch (err) {
        console.error('[editorController] createSnapshot:', err);
        res.status(500).json({ message: 'Eroare la salvarea planului.' });
    }
});
exports.createSnapshot = createSnapshot;
/**
 * GET /api/editor/snapshots/:projectId
 * Lista ultimele 20 snapshot-uri (metadate, fără planJSON).
 */
const listSnapshots = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: 'projectId invalid.' });
            return;
        }
        const floor = req.query.floor;
        const validFloors = ['parter', 'etaj1'];
        const safeFloor = floor && validFloors.includes(floor) ? floor : undefined;
        const snapshots = yield editorService_1.editorService.listSnapshots(projectId, safeFloor);
        res.json(snapshots);
    }
    catch (err) {
        console.error('[editorController] listSnapshots:', err);
        res.status(500).json({ message: 'Eroare la încărcarea istoricului.' });
    }
});
exports.listSnapshots = listSnapshots;
/**
 * GET /api/editor/snapshots/single/:id
 * Conținut complet al unui snapshot (pentru restore).
 */
const getSnapshot = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const snapshotId = parseInt(req.params.id);
        if (isNaN(snapshotId)) {
            res.status(400).json({ message: 'snapshotId invalid.' });
            return;
        }
        if (!(yield editorService_1.editorService.verifySnapshotOwnership(snapshotId, userId))) {
            res.status(403).json({ message: 'Acces interzis.' });
            return;
        }
        const snapshot = yield editorService_1.editorService.getSnapshot(snapshotId);
        if (!snapshot) {
            res.status(404).json({ message: 'Snapshot negăsit.' });
            return;
        }
        res.json(snapshot);
    }
    catch (err) {
        console.error('[editorController] getSnapshot:', err);
        res.status(500).json({ message: 'Eroare la încărcarea planului.' });
    }
});
exports.getSnapshot = getSnapshot;
/**
 * GET /api/editor/latest/:projectId
 * Cel mai recent snapshot — pentru inițializare editor.
 */
const getLatestSnapshot = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: 'projectId invalid.' });
            return;
        }
        const floor = req.query.floor;
        const validFloors = ['parter', 'etaj1'];
        const safeFloor = floor && validFloors.includes(floor) ? floor : undefined;
        const snapshot = yield editorService_1.editorService.getLatestSnapshot(projectId, safeFloor);
        res.json(snapshot !== null && snapshot !== void 0 ? snapshot : null);
    }
    catch (err) {
        console.error('[editorController] getLatestSnapshot:', err);
        res.status(500).json({ message: 'Eroare.' });
    }
});
exports.getLatestSnapshot = getLatestSnapshot;
/**
 * PATCH /api/editor/snapshots/:id/publish
 * Marchează snapshot ca versiune oficială → input Faza 3.
 */
const publishSnapshot = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const snapshotId = parseInt(req.params.id);
        const projectId = parseInt(req.body.projectId);
        if (isNaN(snapshotId)) {
            res.status(400).json({ message: 'snapshotId invalid.' });
            return;
        }
        if (isNaN(projectId)) {
            res.status(400).json({ message: 'projectId este obligatoriu și trebuie să fie număr.' });
            return;
        }
        if (!(yield editorService_1.editorService.verifySnapshotOwnership(snapshotId, userId, projectId))) {
            res.status(403).json({ message: 'Acces interzis sau snapshot-ul nu aparține acestui proiect.' });
            return;
        }
        const published = yield editorService_1.editorService.publishSnapshot(snapshotId, projectId);
        res.json(published);
    }
    catch (error) {
        console.error('[EditorController] Eroare publishSnapshot:', error);
        res.status(500).json({ message: 'Eroare la publicare', details: error.message });
    }
});
exports.publishSnapshot = publishSnapshot;
const publishLatestSnapshot = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: 'projectId este obligatoriu.' });
            return;
        }
        const latest = yield editorService_1.editorService.getLatestSnapshot(projectId);
        if (!latest) {
            res.status(404).json({ message: 'Niciun snapshot găsit pentru a fi publicat.' });
            return;
        }
        const published = yield editorService_1.editorService.publishSnapshot(latest.id, projectId);
        res.json(published);
    }
    catch (error) {
        console.error('[EditorController] Eroare publishLatestSnapshot:', error);
        res.status(500).json({ message: 'Eroare la publicare', details: error.message });
    }
});
exports.publishLatestSnapshot = publishLatestSnapshot;
/**
 * DELETE /api/editor/snapshots/:id
 * Ștergere snapshot cu verificare ownership.
 */
const deleteSnapshot = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const snapshotId = parseInt(req.params.id);
        if (isNaN(snapshotId)) {
            res.status(400).json({ message: 'snapshotId invalid.' });
            return;
        }
        if (!(yield editorService_1.editorService.verifySnapshotOwnership(snapshotId, userId))) {
            res.status(403).json({ message: 'Acces interzis.' });
            return;
        }
        yield editorService_1.editorService.deleteSnapshot(snapshotId);
        res.json({ message: 'Snapshot șters.' });
    }
    catch (err) {
        console.error('[editorController] deleteSnapshot:', err);
        res.status(500).json({ message: 'Eroare la ștergerea snapshot-ului.' });
    }
});
exports.deleteSnapshot = deleteSnapshot;
/**
 * POST /api/editor/validate-conformity
 * Body: { rooms: [{ id, label?, usableSqm, widthM?, heightM? }], doors?: [{ id, widthM }] }
 * Response: { rooms, violations, warnings }
 */
const validateConformity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rooms, doors, buildingPurpose } = req.body;
        if (!rooms || !Array.isArray(rooms)) {
            res.status(400).json({ message: 'rooms este obligatoriu.' });
            return;
        }
        const results = yield conformityService_1.conformityService.evaluateRooms(rooms, { doors, buildingPurpose });
        res.json(results);
    }
    catch (err) {
        console.error('[editorController] validateConformity:', err);
        res.status(500).json({ message: 'Eroare la validarea conformității.' });
    }
});
exports.validateConformity = validateConformity;
/**
 * POST /api/editor/explain-conformity
 * Body: { violations: [{ label, usableSqm, minRequired }] }
 * Response: SSE stream cu explicație AI (RAG Legea 114/1996).
 */
const explainConformity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    try {
        const { violations } = req.body;
        if (!violations || !Array.isArray(violations) || violations.length === 0) {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }
        const violationsText = violations
            .map((v) => `- ${v.label}: ${v.usableSqm}mp (minim legal: ${v.minRequired}mp)`)
            .join('\n');
        const question = `Explică de ce Legea 114/1996 impune suprafețele minime pentru aceste camere:\n${violationsText}\nFii concis, citează articolele exacte.`;
        const stream = yield agentOrchestrator_1.agentOrchestrator.getAiStreamForChat(question, 'Context: validare conformitate plan 2D conform Legea 114/1996.', [], 'editor');
        try {
            for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                _c = stream_1_1.value;
                _d = false;
                const chunk = _c;
                if (chunk.text) {
                    res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        res.write('data: [DONE]\n\n');
        res.end();
    }
    catch (err) {
        console.error('[editorController] explainConformity:', err);
        res.write(`data: ${JSON.stringify({ text: '⚠️ Serviciul AI nu este disponibil momentan.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    }
});
exports.explainConformity = explainConformity;
/**
 * POST /api/editor/generate-layout
 * Autogenerare plan 2D folosind Template Mapping + Squarified Treemap + Constraint Solver.
 */
const layoutGeneratorService_1 = require("../../core/services/layoutGeneratorService");
const generateLayout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, totalFloorAreaSqm, style, bedrooms } = req.body;
        if (!totalFloorAreaSqm || !style || bedrooms === undefined) {
            res.status(400).json({ message: 'Date insuficiente pentru generare (necesar: totalFloorAreaSqm, style, bedrooms).' });
            return;
        }
        const elements = layoutGeneratorService_1.LayoutGeneratorService.generateLayout({
            totalFloorAreaSqm: Number(totalFloorAreaSqm),
            style: String(style),
            bedrooms: Number(bedrooms)
        });
        res.json({ elements });
    }
    catch (error) {
        console.error('[EditorController] Eroare autogenerare layout:', error);
        res.status(500).json({ message: 'Eroare la generarea planului', details: error.message });
    }
});
exports.generateLayout = generateLayout;
/**
 * POST /api/editor/generate-configurator-layout
 * API port from frontend layoutPartitioner.ts
 */
const layoutPartitioner_1 = require("../../core/services/layout/layoutPartitioner");
const generateConfiguratorLayout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { shape, dimensions, rooms, streetOrientation } = req.body;
        if (!shape || !dimensions || !rooms) {
            res.status(400).json({ message: 'shape, dimensions, și rooms sunt obligatorii.' });
            return;
        }
        const elements = (0, layoutPartitioner_1.generateConfiguratorLayout)(shape, dimensions, rooms, streetOrientation || 'S');
        res.json({ elements });
    }
    catch (error) {
        console.error('[EditorController] Eroare layout partitioner:', error);
        res.status(500).json({ message: 'Eroare la generarea planului detaliat', details: error.message });
    }
});
exports.generateConfiguratorLayout = generateConfiguratorLayout;
