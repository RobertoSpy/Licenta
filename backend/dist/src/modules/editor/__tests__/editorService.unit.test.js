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
const editorService_1 = require("../editorService");
const editorRepository_1 = require("../editorRepository");
jest.mock('../editorRepository');
describe('Editor Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('publishSnapshot', () => {
        it('invalidates existing BOM and sets other snapshots to false', () => __awaiter(void 0, void 0, void 0, function* () {
            // Setup mock return
            const mockPublishedSnapshot = { id: 1, isPublished: true };
            editorRepository_1.editorRepository.publishSnapshot.mockResolvedValue(mockPublishedSnapshot);
            const result = yield editorService_1.editorService.publishSnapshot(1, 10);
            expect(editorRepository_1.editorRepository.publishSnapshot).toHaveBeenCalledWith(1, 10);
            expect(result).toEqual(mockPublishedSnapshot);
            // We rely on editorRepository testing for the DB details, but we document what happens
        }));
    });
    describe('saveSnapshot', () => {
        it('creates snapshot and then triggers cleanup', () => __awaiter(void 0, void 0, void 0, function* () {
            editorRepository_1.editorRepository.createSnapshot.mockResolvedValue({ id: 1 });
            const result = yield editorService_1.editorService.saveSnapshot(10, { data: 'test' }, 'parter', 'label');
            expect(editorRepository_1.editorRepository.createSnapshot).toHaveBeenCalledWith(10, { data: 'test' }, 'parter', 'label');
            expect(editorRepository_1.editorRepository.cleanupOldSnapshots).toHaveBeenCalledWith(10, 'parter');
            expect(result).toEqual({ id: 1 });
        }));
    });
    describe('Delegation methods', () => {
        it('listSnapshots delegates correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            yield editorService_1.editorService.listSnapshots(1, 'parter');
            expect(editorRepository_1.editorRepository.listSnapshots).toHaveBeenCalledWith(1, 'parter');
        }));
        it('getSnapshot delegates correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            yield editorService_1.editorService.getSnapshot(1);
            expect(editorRepository_1.editorRepository.getSnapshot).toHaveBeenCalledWith(1);
        }));
        it('verifySnapshotOwnership delegates correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            yield editorService_1.editorService.verifySnapshotOwnership(1, 10, 100);
            expect(editorRepository_1.editorRepository.verifySnapshotOwnership).toHaveBeenCalledWith(1, 10, 100);
        }));
        it('getLatestSnapshot delegates correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            yield editorService_1.editorService.getLatestSnapshot(1, 'etaj1');
            expect(editorRepository_1.editorRepository.getLatestSnapshot).toHaveBeenCalledWith(1, 'etaj1');
        }));
        it('deleteSnapshot delegates correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            yield editorService_1.editorService.deleteSnapshot(1);
            expect(editorRepository_1.editorRepository.deleteSnapshot).toHaveBeenCalledWith(1);
        }));
    });
});
