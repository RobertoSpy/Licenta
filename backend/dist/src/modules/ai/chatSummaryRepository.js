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
exports.chatSummaryRepository = void 0;
const prisma_1 = require("../../lib/prisma");
exports.chatSummaryRepository = {
    /**
     * Returnează un singur rezumat pentru combinația (projectId, phase, screen).
     * Folosit la mount-ul unui ecran pentru a restaura contextul conversației.
     */
    getOne(projectId, phase, screen) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.chatSummary.findUnique({
                where: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    projectId_phase_screen: { projectId, phase, screen }
                }
            });
        });
    },
    /**
     * Returnează rezumatele pentru un set de screen-uri (dependențe).
     * Folosit pentru a construi contextul cross-screen la mount.
     */
    getMany(projectId, screens) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.chatSummary.findMany({
                where: {
                    projectId,
                    screen: { in: screens }
                },
                orderBy: { createdAt: 'asc' }
            });
        });
    },
    /**
     * Creează sau actualizează rezumatul pentru (projectId, phase, screen).
     * Apelat automat de useZidarioChat la fiecare 10 mesaje.
     */
    upsert(projectId, phase, screen, summary) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.chatSummary.upsert({
                where: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    projectId_phase_screen: { projectId, phase, screen }
                },
                update: { summary, updatedAt: new Date() },
                create: { projectId, phase, screen, summary }
            });
        });
    }
};
