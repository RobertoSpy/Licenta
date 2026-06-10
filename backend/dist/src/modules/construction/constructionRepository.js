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
exports.constructionRepository = void 0;
const prisma_1 = require("../../lib/prisma");
class ConstructionRepository {
    getByProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.constructionPhase.findMany({
                where: { projectId },
                orderBy: { phaseOrder: 'asc' }
            });
        });
    }
    createMany(phases) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.constructionPhase.createMany({
                data: phases
            });
        });
    }
    deleteByProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.constructionPhase.deleteMany({
                where: { projectId }
            });
        });
    }
    markPhaseCompleted(projectId, phaseOrder) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.constructionPhase.update({
                where: {
                    projectId_phaseOrder: {
                        projectId,
                        phaseOrder
                    }
                },
                data: {
                    isCompleted: true,
                    completedAt: new Date()
                }
            });
        });
    }
}
exports.constructionRepository = new ConstructionRepository();
