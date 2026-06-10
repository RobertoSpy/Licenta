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
exports.editorService = void 0;
const editorRepository_1 = require("./editorRepository");
exports.editorService = {
    /**
     * Salvare snapshot (auto-save sau manual Ctrl+S) pentru un etaj specific.
     * Apelează cleanup automat după salvare (păstrează ultimele 20 per etaj).
     */
    saveSnapshot(projectId_1, planJSON_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, planJSON, floor = 'parter', label) {
            const snapshot = yield editorRepository_1.editorRepository.createSnapshot(projectId, planJSON, floor, label);
            yield editorRepository_1.editorRepository.cleanupOldSnapshots(projectId, floor);
            return snapshot;
        });
    },
    /**
     * Lista ultimelor 20 snapshot-uri pentru un proiect.
     * Dacă floor e specificat — filtrează pe etaj.
     */
    listSnapshots(projectId, floor) {
        return __awaiter(this, void 0, void 0, function* () {
            return editorRepository_1.editorRepository.listSnapshots(projectId, floor);
        });
    },
    /**
     * Conținut complet snapshot — pentru restore în editor.
     */
    getSnapshot(snapshotId) {
        return __awaiter(this, void 0, void 0, function* () {
            return editorRepository_1.editorRepository.getSnapshot(snapshotId);
        });
    },
    /**
     * Ownership check pentru snapshot (via proiect) cu extra layer anti-cross-project reference.
     */
    verifySnapshotOwnership(snapshotId, userId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return editorRepository_1.editorRepository.verifySnapshotOwnership(snapshotId, userId, projectId);
        });
    },
    /**
     * Cel mai recent snapshot al unui proiect pe etajul specificat.
     */
    getLatestSnapshot(projectId, floor) {
        return __awaiter(this, void 0, void 0, function* () {
            return editorRepository_1.editorRepository.getLatestSnapshot(projectId, floor);
        });
    },
    /**
     * Publică snapshot ca versiunea oficială → input pentru Faza 3 (BOM).
     */
    publishSnapshot(snapshotId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return editorRepository_1.editorRepository.publishSnapshot(snapshotId, projectId);
        });
    },
    /**
     * Ștergere snapshot (cu validare ownership în controller).
     */
    deleteSnapshot(snapshotId) {
        return __awaiter(this, void 0, void 0, function* () {
            return editorRepository_1.editorRepository.deleteSnapshot(snapshotId);
        });
    },
};
