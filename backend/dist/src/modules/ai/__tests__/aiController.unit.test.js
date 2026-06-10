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
const aiController_1 = require("../aiController");
const agentOrchestrator_1 = require("../services/agentOrchestrator");
const chatSummaryRepository_1 = require("../chatSummaryRepository");
const projectRepository_1 = require("../../project/projectRepository");
jest.mock('../services/agentOrchestrator', () => ({
    agentOrchestrator: {
        getAiStreamForChat: jest.fn()
    },
    suggestRoomProgram: jest.fn()
}));
jest.mock('../chatSummaryRepository', () => ({
    chatSummaryRepository: {
        getOne: jest.fn(),
        upsert: jest.fn()
    }
}));
jest.mock('../../project/projectRepository', () => ({
    projectRepository: {
        findById: jest.fn()
    }
}));
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        project: { findUnique: jest.fn() },
        material: { findUnique: jest.fn() },
        projectBOM: { findMany: jest.fn() }
    }
}));
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn();
    res.flushHeaders = jest.fn();
    res.write = jest.fn();
    res.end = jest.fn();
    res.on = jest.fn();
    return res;
}
describe('aiController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('chatStream', () => {
        it('returns 400 if message is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield aiController_1.aiController.chatStream(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('streams response successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { message: 'hello', contextString: 'ctx' } };
            const res = mockRes();
            function mockStream() {
                return __asyncGenerator(this, arguments, function* mockStream_1() {
                    yield yield __await({ text: 'Hel' });
                    yield yield __await({ text: 'lo' });
                });
            }
            agentOrchestrator_1.agentOrchestrator.getAiStreamForChat.mockResolvedValue(mockStream());
            yield aiController_1.aiController.chatStream(req, res);
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
            expect(res.write).toHaveBeenCalledWith(expect.stringContaining('Hel'));
            expect(res.write).toHaveBeenCalledWith(expect.stringContaining('lo'));
            expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
            expect(res.end).toHaveBeenCalled();
        }));
        it('handles errors and writes error message to stream', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { message: 'hello' } };
            const res = mockRes();
            agentOrchestrator_1.agentOrchestrator.getAiStreamForChat.mockRejectedValue(new Error('503 Service Unavailable'));
            yield aiController_1.aiController.chatStream(req, res);
            expect(res.write).toHaveBeenCalledWith(expect.stringContaining('suprasolicitat'));
        }));
    });
    describe('summarizeConversation', () => {
        it('returns 400 if text is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield aiController_1.aiController.summarizeConversation(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
    });
    describe('getSummary', () => {
        it('returns 400 if phase is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { params: { projectId: '1' }, query: {} };
            const res = mockRes();
            yield aiController_1.aiController.getSummary(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns summary', () => __awaiter(void 0, void 0, void 0, function* () {
            chatSummaryRepository_1.chatSummaryRepository.getOne.mockResolvedValue({ summary: 'test' });
            const req = { params: { projectId: '1' }, query: { phase: 'A' } };
            const res = mockRes();
            yield aiController_1.aiController.getSummary(req, res);
            expect(res.json).toHaveBeenCalledWith({ summary: 'test' });
        }));
    });
    describe('saveSummary', () => {
        it('returns 400 if phase or summary missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { projectId: 1, phase: 'A' } };
            const res = mockRes();
            yield aiController_1.aiController.saveSummary(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('saves summary and returns success', () => __awaiter(void 0, void 0, void 0, function* () {
            chatSummaryRepository_1.chatSummaryRepository.upsert.mockResolvedValue({ id: 10 });
            const req = { body: { projectId: 1, phase: 'A', summary: 'sum' } };
            const res = mockRes();
            yield aiController_1.aiController.saveSummary(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, id: 10 });
        }));
    });
    describe('suggestRooms', () => {
        it('returns 400 if required fields missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: {} };
            const res = mockRes();
            yield aiController_1.aiController.suggestRooms(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 400 for invalid budget', () => __awaiter(void 0, void 0, void 0, function* () {
            const req = { body: { projectId: 1, familySize: 3, budgetCategory: 'invalid', houseAreaSqm: 100 } };
            const res = mockRes();
            yield aiController_1.aiController.suggestRooms(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        }));
        it('returns 404 if project not found', () => __awaiter(void 0, void 0, void 0, function* () {
            projectRepository_1.projectRepository.findById.mockResolvedValue(null);
            const req = { body: { projectId: 1, familySize: 3, budgetCategory: 'mediu', houseAreaSqm: 100 } };
            const res = mockRes();
            yield aiController_1.aiController.suggestRooms(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }));
        it('returns room suggestion', () => __awaiter(void 0, void 0, void 0, function* () {
            projectRepository_1.projectRepository.findById.mockResolvedValue({ plotAreaSqm: 500 });
            agentOrchestrator_1.suggestRoomProgram.mockResolvedValue({ living: 30 });
            const req = { body: { projectId: 1, familySize: 3, budgetCategory: 'mediu', houseAreaSqm: 100 } };
            const res = mockRes();
            yield aiController_1.aiController.suggestRooms(req, res);
            expect(res.json).toHaveBeenCalledWith({ living: 30 });
        }));
    });
});
