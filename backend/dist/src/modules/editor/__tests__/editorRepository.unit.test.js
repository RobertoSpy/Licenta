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
const editorRepository_1 = require("../editorRepository");
const setup_1 = require("../../../../tests/setup");
jest.mock('../../../lib/planMetricsExtractor', () => ({
    extractMetricsFromSnapshot: jest.fn()
}));
describe('Editor Repository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('cleanupOldSnapshots', () => {
        it('does nothing if snapshots count is <= 20', () => __awaiter(void 0, void 0, void 0, function* () {
            // Return 15 snapshots
            setup_1.prismaMock.planSnapshot.findMany.mockResolvedValue(Array.from({ length: 15 }).map((_, i) => ({ id: i })));
            yield editorRepository_1.editorRepository.cleanupOldSnapshots(1, 'parter');
            expect(setup_1.prismaMock.planSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { projectId: 1, floor: 'parter', isPublished: false },
                orderBy: { createdAt: 'desc' }
            }));
            expect(setup_1.prismaMock.planSnapshot.deleteMany).not.toHaveBeenCalled();
        }));
        it('keeps exactly 20 most recent snapshots when 21 exist', () => __awaiter(void 0, void 0, void 0, function* () {
            // 21 snapshots returned (index 0..20)
            const mockSnapshots = Array.from({ length: 21 }).map((_, i) => ({ id: i }));
            setup_1.prismaMock.planSnapshot.findMany.mockResolvedValue(mockSnapshots);
            yield editorRepository_1.editorRepository.cleanupOldSnapshots(1, 'parter');
            expect(setup_1.prismaMock.planSnapshot.deleteMany).toHaveBeenCalledWith({
                where: { id: { in: [20] } } // Only the 21st item should be deleted
            });
        }));
        it('keeps exactly 20 most recent snapshots when 100 exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockSnapshots = Array.from({ length: 100 }).map((_, i) => ({ id: i }));
            setup_1.prismaMock.planSnapshot.findMany.mockResolvedValue(mockSnapshots);
            yield editorRepository_1.editorRepository.cleanupOldSnapshots(1, 'parter');
            // Should delete 80 items (index 20 to 99)
            const expectedToDelete = Array.from({ length: 80 }).map((_, i) => i + 20);
            expect(setup_1.prismaMock.planSnapshot.deleteMany).toHaveBeenCalledWith({
                where: { id: { in: expectedToDelete } }
            });
        }));
        it('does not delete published snapshot even if it is oldest', () => __awaiter(void 0, void 0, void 0, function* () {
            // The `findMany` query explicitly filters by `isPublished: false`.
            // We verify the query arguments to ensure this rule is enforced at the DB query level.
            yield editorRepository_1.editorRepository.cleanupOldSnapshots(1, 'parter');
            expect(setup_1.prismaMock.planSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ isPublished: false })
            }));
        }));
    });
    describe('verifySnapshotOwnership', () => {
        it('returns true when all ownership checks pass', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findUnique.mockResolvedValue({
                id: 1,
                project: { id: 10, userId: 100 }
            });
            const result = yield editorRepository_1.editorRepository.verifySnapshotOwnership(1, 100, 10);
            expect(result).toBe(true);
        }));
        it('returns false when snapshot exists but belongs to different project', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findUnique.mockResolvedValue({
                id: 1,
                project: { id: 20, userId: 100 } // User owns it, but it's project 20
            });
            const result = yield editorRepository_1.editorRepository.verifySnapshotOwnership(1, 100, 10);
            expect(result).toBe(false);
        }));
        it('returns false when project exists but belongs to different user', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findUnique.mockResolvedValue({
                id: 1,
                project: { id: 10, userId: 200 } // Project 10, but owned by user 200
            });
            const result = yield editorRepository_1.editorRepository.verifySnapshotOwnership(1, 100, 10);
            expect(result).toBe(false);
        }));
        it('returns false when snapshot does not exist at all', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findUnique.mockResolvedValue(null);
            const result = yield editorRepository_1.editorRepository.verifySnapshotOwnership(1, 100, 10);
            expect(result).toBe(false);
        }));
        it('returns true when omitting projectId check and user owns it', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findUnique.mockResolvedValue({
                id: 1,
                project: { id: 20, userId: 100 } // No projectId passed, so it should only check userId
            });
            const result = yield editorRepository_1.editorRepository.verifySnapshotOwnership(1, 100);
            expect(result).toBe(true);
        }));
    });
    describe('createSnapshot', () => {
        it('creates snapshot with incremented version', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findFirst.mockResolvedValue({ version: 5 });
            setup_1.prismaMock.planSnapshot.create.mockResolvedValue({ id: 10, version: 6 });
            const res = yield editorRepository_1.editorRepository.createSnapshot(1, {}, 'parter', 'L1');
            expect(setup_1.prismaMock.planSnapshot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 1, floor: 'parter' } }));
            expect(setup_1.prismaMock.planSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
                data: { projectId: 1, planJSON: {}, floor: 'parter', version: 6, label: 'L1' }
            }));
            expect(res).toEqual({ id: 10, version: 6 });
        }));
        it('creates snapshot with version 1 if none exists', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findFirst.mockResolvedValue(null);
            yield editorRepository_1.editorRepository.createSnapshot(1, {}, 'etaj1');
            expect(setup_1.prismaMock.planSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ version: 1 })
            }));
        }));
    });
    describe('listSnapshots', () => {
        it('lists snapshots', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findMany.mockResolvedValue([{ id: 1 }]);
            const res = yield editorRepository_1.editorRepository.listSnapshots(1, 'parter');
            expect(setup_1.prismaMock.planSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 1, floor: 'parter' } }));
            expect(res).toEqual([{ id: 1 }]);
        }));
    });
    describe('publishSnapshot', () => {
        it('extracts area successfully and updates project', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.updateMany.mockResolvedValue({});
            setup_1.prismaMock.planSnapshot.update.mockResolvedValue({
                id: 1,
                project: { totalFloors: 1 },
                planJSON: {}
            });
            setup_1.prismaMock.project.update.mockResolvedValue({});
            const { extractMetricsFromSnapshot } = require('../../../lib/planMetricsExtractor');
            extractMetricsFromSnapshot.mockReturnValue({
                fromSnapshot: true,
                metrics: { totalFloorAreaSqm: 150 }
            });
            yield editorRepository_1.editorRepository.publishSnapshot(1, 100);
            expect(setup_1.prismaMock.project.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    totalFloorAreaSqm: 150
                })
            }));
        }));
        it('catches and logs error if extractMetricsFromSnapshot throws', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.updateMany.mockResolvedValue({});
            setup_1.prismaMock.planSnapshot.update.mockResolvedValue({
                id: 1,
                project: { totalFloors: 1 },
                planJSON: {}
            });
            setup_1.prismaMock.project.update.mockResolvedValue({});
            const { extractMetricsFromSnapshot } = require('../../../lib/planMetricsExtractor');
            extractMetricsFromSnapshot.mockImplementation(() => {
                throw new Error('Metrics Error');
            });
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            yield editorRepository_1.editorRepository.publishSnapshot(1, 100);
            expect(consoleSpy).toHaveBeenCalledWith('[publishSnapshot] Eroare extragere suprafata:', expect.any(Error));
            consoleSpy.mockRestore();
        }));
    });
    describe('getSnapshot', () => {
        it('returns snapshot', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findUnique.mockResolvedValue({ id: 1 });
            const res = yield editorRepository_1.editorRepository.getSnapshot(1);
            expect(res).toEqual({ id: 1 });
        }));
    });
    describe('getLatestSnapshot', () => {
        it('gets latest', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.findFirst.mockResolvedValue({ id: 5 });
            const res = yield editorRepository_1.editorRepository.getLatestSnapshot(1, 'parter');
            expect(res).toEqual({ id: 5 });
        }));
    });
    describe('deleteSnapshot', () => {
        it('deletes snapshot', () => __awaiter(void 0, void 0, void 0, function* () {
            yield editorRepository_1.editorRepository.deleteSnapshot(1);
            expect(setup_1.prismaMock.planSnapshot.delete).toHaveBeenCalledWith({ where: { id: 1 } });
        }));
    });
    describe('publishSnapshot', () => {
        it('publishes and updates project', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.planSnapshot.update.mockResolvedValue({ id: 1, planJSON: {}, project: { totalFloors: 1 } });
            const res = yield editorRepository_1.editorRepository.publishSnapshot(1, 2);
            expect(setup_1.prismaMock.planSnapshot.updateMany).toHaveBeenCalledWith({ where: { projectId: 2 }, data: { isPublished: false } });
            expect(setup_1.prismaMock.planSnapshot.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isPublished: true } }));
            expect(setup_1.prismaMock.project.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ publishedSnapshotId: 1, bomGeneratedAt: null })
            }));
            expect(res).toEqual(expect.objectContaining({ id: 1 }));
        }));
    });
});
