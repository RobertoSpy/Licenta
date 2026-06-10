"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const editorController_1 = require("../editorController");
const editorService_1 = require("../editorService");
const conformityService_1 = require("../../../core/services/conformityService");
const agentOrchestrator_1 = require("../../ai/services/agentOrchestrator");
const layoutGeneratorService_1 = require("../../../core/services/layoutGeneratorService");
const layoutPartitioner = __importStar(require("../../../core/services/layout/layoutPartitioner"));
jest.mock('../editorService');
jest.mock('../../../core/services/conformityService');
jest.mock('../../ai/services/agentOrchestrator', () => ({
    agentOrchestrator: { getAiStreamForChat: jest.fn() }
}));
jest.mock('../../../core/services/layoutGeneratorService');
jest.mock('../../../core/services/layout/layoutPartitioner', () => ({
    generateConfiguratorLayout: jest.fn()
}));
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn();
    res.flushHeaders = jest.fn();
    res.write = jest.fn();
    res.end = jest.fn();
    return res;
}
describe('editorController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('createSnapshot', () => {
        it('returns 400 if projectId or planJSON missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield (0, editorController_1.createSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('creates snapshot', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.saveSnapshot.mockResolvedValue({ id: 1 });
            const req = { body: { projectId: 1, planJSON: {}, floor: 'parter', label: 'test' } };
            const res = mockRes();
            yield (0, editorController_1.createSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 1 });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.saveSnapshot.mockRejectedValue(new Error('err'));
            const req = { body: { projectId: 1, planJSON: {}, floor: 'parter', label: 'test' } };
            const res = mockRes();
            yield (0, editorController_1.createSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('listSnapshots', () => {
        it('returns 400 if projectId is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: 'a' }, query: {} };
            const res = mockRes();
            yield (0, editorController_1.listSnapshots)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns list', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.listSnapshots.mockResolvedValue([{ id: 1 }]);
            const req = { params: { projectId: '1' }, query: {} };
            const res = mockRes();
            yield (0, editorController_1.listSnapshots)(req, res);
            expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.listSnapshots.mockRejectedValue(new Error('err'));
            const req = { params: { projectId: '1' }, query: {} };
            const res = mockRes();
            yield (0, editorController_1.listSnapshots)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getSnapshot', () => {
        it('returns 400 if id invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: 'a' } };
            const res = mockRes();
            yield (0, editorController_1.getSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 403 if not owner', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockResolvedValue(false);
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.getSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('returns 404 if not found', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockResolvedValue(true);
            editorService_1.editorService.getSnapshot.mockResolvedValue(null);
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.getSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('returns snapshot', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockResolvedValue(true);
            editorService_1.editorService.getSnapshot.mockResolvedValue({ id: 1 });
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.getSnapshot)(req, res);
            expect(res.json).toHaveBeenCalledWith({ id: 1 });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockRejectedValue(new Error('err'));
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.getSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getLatestSnapshot', () => {
        it('returns 400 if projectId is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: 'a' }, query: {} };
            const res = mockRes();
            yield (0, editorController_1.getLatestSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns latest', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.getLatestSnapshot.mockResolvedValue({ id: 2 });
            const req = { params: { projectId: '1' }, query: {} };
            const res = mockRes();
            yield (0, editorController_1.getLatestSnapshot)(req, res);
            expect(res.json).toHaveBeenCalledWith({ id: 2 });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.getLatestSnapshot.mockRejectedValue(new Error('err'));
            const req = { params: { projectId: '1' }, query: {} };
            const res = mockRes();
            yield (0, editorController_1.getLatestSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('publishSnapshot', () => {
        it('returns 400 if snapshotId invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: 'a' }, body: { projectId: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.publishSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 400 if projectId invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: '1' }, body: { projectId: 'a' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.publishSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 403 if not owner', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockResolvedValue(false);
            const req = { params: { id: '1' }, body: { projectId: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.publishSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('publishes', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockResolvedValue(true);
            editorService_1.editorService.publishSnapshot.mockResolvedValue({ id: 1 });
            const req = { params: { id: '1' }, body: { projectId: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.publishSnapshot)(req, res);
            expect(res.json).toHaveBeenCalledWith({ id: 1 });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockRejectedValue(new Error('err'));
            const req = { params: { id: '1' }, body: { projectId: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.publishSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('deleteSnapshot', () => {
        it('returns 400 if snapshotId invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { id: 'a' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.deleteSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 403 if not owner', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockResolvedValue(false);
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.deleteSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }));
        it('deletes', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockResolvedValue(true);
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.deleteSnapshot)(req, res);
            expect(editorService_1.editorService.deleteSnapshot).toHaveBeenCalledWith(1);
            expect(res.json).toHaveBeenCalledWith({ message: 'Snapshot șters.' });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            editorService_1.editorService.verifySnapshotOwnership.mockRejectedValue(new Error('err'));
            const req = { params: { id: '1' }, user: { id: 1 } };
            const res = mockRes();
            yield (0, editorController_1.deleteSnapshot)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('validateConformity', () => {
        it('returns 400 if rooms missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield (0, editorController_1.validateConformity)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns conformity results', () => __awaiter(void 0, void 0, void 0, function* () {
            conformityService_1.conformityService.evaluateRooms.mockResolvedValue({ valid: true });
            const req = { body: { rooms: [] } };
            const res = mockRes();
            yield (0, editorController_1.validateConformity)(req, res);
            expect(res.json).toHaveBeenCalledWith({ valid: true });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            conformityService_1.conformityService.evaluateRooms.mockRejectedValue(new Error('err'));
            const req = { body: { rooms: [] } };
            const res = mockRes();
            yield (0, editorController_1.validateConformity)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('explainConformity', () => {
        it('returns early if no violations', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { violations: [] } };
            const res = mockRes();
            yield (0, editorController_1.explainConformity)(req, res);
            expect(res.end).toHaveBeenCalled();
        }));
        it('streams ai response', () => __awaiter(void 0, void 0, void 0, function* () {
            function mockStream() { return __asyncGenerator(this, arguments, function* mockStream_1() { yield yield __await({ text: 'test' }); }); }
            agentOrchestrator_1.agentOrchestrator.getAiStreamForChat.mockResolvedValue(mockStream());
            const req = { body: { violations: [{ label: 'L', usableSqm: 10, minRequired: 12 }] } };
            const res = mockRes();
            yield (0, editorController_1.explainConformity)(req, res);
            expect(res.write).toHaveBeenCalledWith(expect.stringContaining('test'));
        }));
        it('writes error to stream on exception', () => __awaiter(void 0, void 0, void 0, function* () {
            agentOrchestrator_1.agentOrchestrator.getAiStreamForChat.mockRejectedValue(new Error('err'));
            const req = { body: { violations: [{ label: 'L', usableSqm: 10, minRequired: 12 }] } };
            const res = mockRes();
            yield (0, editorController_1.explainConformity)(req, res);
            expect(res.write).toHaveBeenCalledWith(expect.stringContaining('nu este disponibil'));
            expect(res.end).toHaveBeenCalled();
        }));
    });
    describe('generateLayout', () => {
        it('returns 400 if missing args', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield (0, editorController_1.generateLayout)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns layout', () => __awaiter(void 0, void 0, void 0, function* () {
            layoutGeneratorService_1.LayoutGeneratorService.generateLayout.mockReturnValue([]);
            const req = { body: { projectId: 1, totalFloorAreaSqm: 100, style: 'Modern', bedrooms: 2 } };
            const res = mockRes();
            yield (0, editorController_1.generateLayout)(req, res);
            expect(res.json).toHaveBeenCalledWith({ elements: [] });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            layoutGeneratorService_1.LayoutGeneratorService.generateLayout.mockImplementation(() => { throw new Error('err'); });
            const req = { body: { projectId: 1, totalFloorAreaSqm: 100, style: 'Modern', bedrooms: 2 } };
            const res = mockRes();
            yield (0, editorController_1.generateLayout)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('generateConfiguratorLayout', () => {
        it('returns 400 if missing args', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield (0, editorController_1.generateConfiguratorLayout)(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns configurator layout', () => __awaiter(void 0, void 0, void 0, function* () {
            layoutPartitioner.generateConfiguratorLayout.mockReturnValue([]);
            const req = { body: { shape: 'L', dimensions: {}, rooms: [] } };
            const res = mockRes();
            yield (0, editorController_1.generateConfiguratorLayout)(req, res);
            expect(res.json).toHaveBeenCalledWith({ elements: [] });
        }));
        it('returns 500 on error', () => __awaiter(void 0, void 0, void 0, function* () {
            layoutPartitioner.generateConfiguratorLayout.mockImplementation(() => { throw new Error('err'); });
            const req = { body: { shape: 'L', dimensions: {}, rooms: [] } };
            const res = mockRes();
            yield (0, editorController_1.generateConfiguratorLayout)(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        }));
    });
});
