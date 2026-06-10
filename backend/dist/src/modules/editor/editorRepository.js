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
exports.editorRepository = void 0;
const prisma_1 = require("../../lib/prisma");
const planMetricsExtractor_1 = require("../../lib/planMetricsExtractor");
exports.editorRepository = {
    /**
     * Creare snapshot nou — auto-increment version per (proiect, etaj).
     */
    createSnapshot(projectId_1, planJSON_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, planJSON, floor = 'parter', label) {
            var _a;
            // Versiunea se incrementează per (proiect, etaj) — nu global
            const last = yield prisma_1.prisma.planSnapshot.findFirst({
                where: { projectId, floor },
                orderBy: { version: 'desc' },
                select: { version: true },
            });
            const nextVersion = ((_a = last === null || last === void 0 ? void 0 : last.version) !== null && _a !== void 0 ? _a : 0) + 1;
            return prisma_1.prisma.planSnapshot.create({
                data: { projectId, planJSON, floor, version: nextVersion, label },
            });
        });
    },
    /**
     * Ultimele 20 snapshot-uri pentru un proiect, opțional filtrate pe etaj.
     */
    listSnapshots(projectId, floor) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.planSnapshot.findMany({
                where: Object.assign({ projectId }, (floor ? { floor } : {})),
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    version: true,
                    floor: true,
                    label: true,
                    isPublished: true,
                    createdAt: true,
                },
            });
        });
    },
    /**
     * Conținutul complet al unui snapshot specific (pentru restore).
     */
    getSnapshot(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.planSnapshot.findUnique({ where: { id } });
        });
    },
    /**
     * Verifică dacă un snapshot aparține userului curent (via proiect),
     * dar permite și injectarea de projectId pentru a asigura non-cross-project reference.
     */
    verifySnapshotOwnership(snapshotId, userId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const snapshot = yield prisma_1.prisma.planSnapshot.findUnique({
                where: { id: snapshotId },
                include: { project: { select: { userId: true, id: true } } },
            });
            if (!snapshot)
                return false;
            if (snapshot.project.userId !== userId)
                return false;
            if (projectId && snapshot.project.id !== projectId)
                return false;
            return true;
        });
    },
    /**
     * Cel mai recent snapshot al unui proiect pe un anumit etaj.
     * Dacă floor nu e specificat → returnează cel mai recent indiferent de etaj (backward compat).
     */
    getLatestSnapshot(projectId, floor) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.planSnapshot.findFirst({
                where: Object.assign({ projectId }, (floor ? { floor } : {})),
                orderBy: { createdAt: 'desc' },
            });
        });
    },
    /**
     * Publică un snapshot — marchează ca versiunea oficială → input pentru Faza 3 (BOM).
     * Dezactivează flag-ul isPublished pe toate celelalte snapshot-uri ale proiectului.
     * Invalidează BOM-ul existent (bomGeneratedAt = null) pentru a garanta sincronizarea.
     */
    publishSnapshot(snapshotId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.planSnapshot.updateMany({
                where: { projectId },
                data: { isPublished: false },
            });
            const published = yield prisma_1.prisma.planSnapshot.update({
                where: { id: snapshotId },
                data: { isPublished: true },
                include: { project: { select: { totalFloors: true } } }
            });
            let totalArea = null;
            try {
                const floorsCount = published.project.totalFloors || 1;
                const res = (0, planMetricsExtractor_1.extractMetricsFromSnapshot)(published.planJSON, floorsCount, 0.9, 0.5);
                if (res.fromSnapshot) {
                    totalArea = res.metrics.totalFloorAreaSqm;
                }
            }
            catch (e) {
                console.error('[publishSnapshot] Eroare extragere suprafata:', e);
            }
            yield prisma_1.prisma.project.update({
                where: { id: projectId },
                data: Object.assign({ publishedSnapshotId: snapshotId, planStatus: 'published', bomGeneratedAt: null }, (totalArea ? { totalFloorAreaSqm: totalArea } : {})),
            });
            return published;
        });
    },
    /**
     * Ștergere snapshot. Ownership check se face în controller.
     */
    deleteSnapshot(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.planSnapshot.delete({ where: { id } });
        });
    },
    /**
     * Auto-cleanup: păstrăm doar ultimele 20 snapshot-uri per (proiect, etaj).
     * Snapshot-urile publicate nu sunt șterse niciodată (indiferent de createdAt).
     */
    cleanupOldSnapshots(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, floor = 'parter') {
            const snapshots = yield prisma_1.prisma.planSnapshot.findMany({
                where: { projectId, floor, isPublished: false },
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            });
            if (snapshots.length > 20) {
                // păstrăm cele mai noi 20 (slice-ul sare peste primele 20 și le ia pe restul pentru ștergere)
                const toDelete = snapshots.slice(20).map((s) => s.id);
                yield prisma_1.prisma.planSnapshot.deleteMany({ where: { id: { in: toDelete } } });
            }
        });
    },
};
