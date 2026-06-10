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
const prisma_1 = require("../../../lib/prisma");
const bomPhaseProgressRepository_1 = require("../bomPhaseProgressRepository");
jest.mock('../../../lib/prisma', () => ({
    prisma: {
        bomPhaseProgress: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));
describe('bomPhaseProgressRepository', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('getByProject', () => {
        it('ar trebui sa returneze progresul fazelor pentru un proiect', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockState = { id: 1, projectId: 1, activePhase: 'structura', completedPhases: ['fundatie'] };
            prisma_1.prisma.bomPhaseProgress.findUnique.mockResolvedValue(mockState);
            const result = yield bomPhaseProgressRepository_1.bomPhaseProgressRepository.getByProject(1);
            expect(prisma_1.prisma.bomPhaseProgress.findUnique).toHaveBeenCalledWith({ where: { projectId: 1 } });
            expect(result).toEqual(mockState);
        }));
    });
    describe('upsert', () => {
        it('ar trebui sa salveze noul state al fazelor', () => __awaiter(void 0, void 0, void 0, function* () {
            const state = { activePhase: 'planseu', completedPhases: ['fundatie', 'structura'] };
            const mockResult = Object.assign({ id: 1, projectId: 1 }, state);
            prisma_1.prisma.bomPhaseProgress.upsert.mockResolvedValue(mockResult);
            const result = yield bomPhaseProgressRepository_1.bomPhaseProgressRepository.upsert(1, state);
            expect(prisma_1.prisma.bomPhaseProgress.upsert).toHaveBeenCalledWith({
                where: { projectId: 1 },
                update: {
                    activePhase: 'planseu',
                    completedPhases: ['fundatie', 'structura'],
                },
                create: {
                    projectId: 1,
                    activePhase: 'planseu',
                    completedPhases: ['fundatie', 'structura'],
                },
            });
            expect(result).toEqual(mockResult);
        }));
    });
});
