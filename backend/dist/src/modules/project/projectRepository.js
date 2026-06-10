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
exports.projectRepository = void 0;
const prisma_1 = require("../../lib/prisma");
exports.projectRepository = {
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.project.findUnique({
                where: { id },
                include: {
                    bomItems: {
                        include: {
                            material: true
                        }
                    }
                }
            });
        });
    },
    findManyByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.project.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    bomItems: true,
                    constructionPhases: true
                }
            });
        });
    },
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const DEFAULT_PHASES = [
                { name: '1. Fundație', description: 'Cofraj, armare, turnare beton', phaseOrder: 1 },
                { name: '2. Structură', description: 'Stâlpi, grinzi, pereți portanți, zidărie', phaseOrder: 2 },
                { name: '3. Planșeu', description: 'Planșeu, grinzi, armătură superioară', phaseOrder: 3 },
                { name: '4. Acoperiș', description: 'Lemnărie, folie, țiglă/tablă, sistem pluvial', phaseOrder: 4 },
                { name: '5. Finisaje', description: 'Șapă, tencuială, glet, vopsea, pardoseli', phaseOrder: 5 },
                { name: '6. Tâmplărie', description: 'Uși, ferestre exterioare și interioare', phaseOrder: 6 },
                { name: '7. Termoizolație', description: 'Izolație fațadă (ETICS), vată minerală, termosistem', phaseOrder: 7 },
                { name: '8. Instalații Electrice', description: 'Cablaje, doze, tablou electric, prize', phaseOrder: 8 },
                { name: '9. Instalații Sanitare și Termice', description: 'Tubulatură, alimentare apă, canalizare, încălzire', phaseOrder: 9 }
            ];
            return prisma_1.prisma.project.create({
                data: Object.assign(Object.assign({}, data), { constructionPhases: {
                        create: DEFAULT_PHASES
                    } })
            });
        });
    },
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.project.update({ where: { id }, data: data });
        });
    },
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.project.delete({ where: { id } });
        });
    }
};
