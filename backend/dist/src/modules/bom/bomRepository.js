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
exports.bomRepository = void 0;
const prisma_1 = require("../../lib/prisma");
class BOMRepository {
    deleteByProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.projectBOM.deleteMany({
                where: { projectId }
            });
        });
    }
    createMany(items) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.projectBOM.createMany({
                data: items
            });
        });
    }
    findByProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.projectBOM.findMany({
                where: { projectId },
                include: {
                    material: true
                },
                orderBy: {
                    phase: 'asc' // Not perfect chronological, but helps group them. In production we might order by phaseOrder from ConstructionPhase
                }
            });
        });
    }
}
exports.bomRepository = new BOMRepository();
