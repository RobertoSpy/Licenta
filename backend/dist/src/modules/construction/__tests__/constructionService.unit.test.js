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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const constructionService_1 = require("../constructionService");
const constructionRepository_1 = require("../constructionRepository");
const fs_1 = __importDefault(require("fs"));
jest.mock('../constructionRepository');
jest.mock('fs');
const mockRepo = constructionRepository_1.constructionRepository;
describe('ConstructionService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('generatePhasesForProject', () => {
        it('throws descriptive error if JSON file is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            fs_1.default.existsSync.mockReturnValue(false);
            yield expect(constructionService_1.constructionService.generatePhasesForProject(1)).rejects.toThrow('MISSING_JSON_FILE');
        }));
        it('throws if JSON is malformed', () => __awaiter(void 0, void 0, void 0, function* () {
            fs_1.default.existsSync.mockReturnValue(true);
            fs_1.default.readFileSync.mockReturnValue('invalid-json');
            yield expect(constructionService_1.constructionService.generatePhasesForProject(1)).rejects.toThrow('MALFORMED_JSON_FILE');
        }));
        it('is idempotent: deletes old phases before creating new ones', () => __awaiter(void 0, void 0, void 0, function* () {
            fs_1.default.existsSync.mockReturnValue(true);
            fs_1.default.readFileSync.mockReturnValue(JSON.stringify([{ order: 1, name: 'Phase 1' }]));
            mockRepo.deleteByProject.mockResolvedValue(undefined);
            mockRepo.createMany.mockResolvedValue(undefined);
            mockRepo.getByProject.mockResolvedValue([{ id: 1 }]);
            yield constructionService_1.constructionService.generatePhasesForProject(1);
            expect(mockRepo.deleteByProject).toHaveBeenCalledWith(1);
            expect(mockRepo.createMany).toHaveBeenCalledWith([expect.objectContaining({ name: 'Phase 1' })]);
            // Verify delete is called before createMany
            const deleteOrder = mockRepo.deleteByProject.mock.invocationCallOrder[0];
            const createOrder = mockRepo.createMany.mock.invocationCallOrder[0];
            expect(deleteOrder).toBeLessThan(createOrder);
        }));
    });
    describe('getProjectPhases', () => {
        it('returns existing phases without generating', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRepo.getByProject.mockResolvedValue([{ id: 1 }]);
            const generateSpy = jest.spyOn(constructionService_1.constructionService, 'generatePhasesForProject');
            const result = yield constructionService_1.constructionService.getProjectPhases(1);
            expect(result).toHaveLength(1);
            expect(generateSpy).not.toHaveBeenCalled();
        }));
        it('generates phases if none exist', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRepo.getByProject
                .mockResolvedValueOnce([]) // First call returns empty
                .mockResolvedValueOnce([{ id: 1 }]); // generatePhasesForProject's call
            fs_1.default.existsSync.mockReturnValue(true);
            fs_1.default.readFileSync.mockReturnValue(JSON.stringify([]));
            const result = yield constructionService_1.constructionService.getProjectPhases(1);
            expect(result).toHaveLength(1);
        }));
    });
    describe('completePhase', () => {
        const mockPhases = [
            { id: 10, phaseOrder: 1, isCompleted: true },
            { id: 11, phaseOrder: 2, isCompleted: false },
            { id: 12, phaseOrder: 3, isCompleted: false },
        ];
        it('throws if phase not found', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRepo.getByProject.mockResolvedValue(mockPhases);
            yield expect(constructionService_1.constructionService.completePhase(1, 99)).rejects.toThrow('PHASE_NOT_FOUND');
        }));
        it('is idempotent: completing an already-completed phase does not throw and returns phase', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRepo.getByProject.mockResolvedValue(mockPhases);
            const result = yield constructionService_1.constructionService.completePhase(1, 1);
            expect(result).toEqual(mockPhases[0]);
            expect(mockRepo.markPhaseCompleted).not.toHaveBeenCalled();
        }));
        it('throws if previous phase is not completed', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRepo.getByProject.mockResolvedValue(mockPhases);
            // Phase 2 is not completed. Trying to complete phase 3.
            yield expect(constructionService_1.constructionService.completePhase(1, 3)).rejects.toThrow('PREREQUISITE_NOT_COMPLETED');
        }));
        it('succeeds when previous phase is completed', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRepo.getByProject.mockResolvedValue(mockPhases);
            // Phase 1 is completed. Trying to complete phase 2.
            mockRepo.markPhaseCompleted.mockResolvedValue({ id: 11, isCompleted: true });
            const result = yield constructionService_1.constructionService.completePhase(1, 2);
            expect(mockRepo.markPhaseCompleted).toHaveBeenCalledWith(1, 2);
            expect(result.isCompleted).toBe(true);
        }));
        it('completePhase on phase 1 (no prerequisite) always succeeds', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockPhasesUncompleted = [
                { id: 10, phaseOrder: 1, isCompleted: false },
            ];
            mockRepo.getByProject.mockResolvedValue(mockPhasesUncompleted);
            mockRepo.markPhaseCompleted.mockResolvedValue({ id: 10, isCompleted: true });
            yield constructionService_1.constructionService.completePhase(1, 1);
            expect(mockRepo.markPhaseCompleted).toHaveBeenCalledWith(1, 1);
        }));
    });
});
