"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.projectService = void 0;
const projectRepository_1 = require("./projectRepository");
const turf = __importStar(require("@turf/turf"));
exports.projectService = {
    calculateTotalFloors(existing, input) {
        var _a, _b;
        const g = (_a = input.hasGroundFloor) !== null && _a !== void 0 ? _a : existing.hasGroundFloor;
        const u = (_b = input.upperFloorsCount) !== null && _b !== void 0 ? _b : existing.upperFloorsCount;
        return (g ? 1 : 0) + (u || 0);
    },
    createProject(userId, title) {
        return __awaiter(this, void 0, void 0, function* () {
            return projectRepository_1.projectRepository.create({ title, userId });
        });
    },
    getUserProjects(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return projectRepository_1.projectRepository.findManyByUserId(userId);
        });
    },
    /**
     * Actualizează proiectul după ID.
     * Dacă `prefetchedProject` este furnizat (ex: de la tenantGuard), se evită un apel suplimentar la baza de date.
     */
    updateProject(projectId, inputData, prefetchedProject) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = prefetchedProject !== null && prefetchedProject !== void 0 ? prefetchedProject : yield projectRepository_1.projectRepository.findById(projectId);
            if (!existing)
                throw new Error('NOT_FOUND');
            let totalFloors;
            if (inputData.hasGroundFloor !== undefined ||
                inputData.upperFloorsCount !== undefined ||
                inputData.hasBasement !== undefined) {
                totalFloors = this.calculateTotalFloors(existing, inputData);
            }
            const isCompleted = inputData.wizardStep === 4 ? true : undefined;
            const data = {};
            const allowedKeys = [
                'title', 'wizardStep', 'lat', 'lng', 'polygonGeoJSON', 'county', 'locality',
                'seismicZone', 'frostDepthCm', 'plotAreaSqm', 'soilType', 'slopePercent',
                'streetOrientation', 'soilNotes', 'maxAllowedFloors', 'minFoundationDepthCm',
                'zoningRestrictions', 'houseStyle', 'hasBasement', 'hasGroundFloor',
                'upperFloorsCount'
            ];
            for (const key of allowedKeys) {
                if (inputData[key] !== undefined) {
                    data[key] = inputData[key];
                }
            }
            if (totalFloors !== undefined)
                data.totalFloors = totalFloors;
            if (isCompleted !== undefined)
                data.isCompleted = isCompleted;
            if (inputData.polygonLatLngs && Array.isArray(inputData.polygonLatLngs) && inputData.polygonLatLngs.length >= 3) {
                try {
                    const coords = inputData.polygonLatLngs.map((p) => [p[1], p[0]]); // GeoJSON wants [lng, lat]
                    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                        coords.push([...coords[0]]); // Close the linear ring
                    }
                    const poly = turf.polygon([coords]);
                    data.polygonGeoJSON = poly.geometry;
                    data.plotAreaSqm = turf.area(poly);
                }
                catch (e) {
                    console.error('Eroare generare poligon/arie:', e);
                }
            }
            return projectRepository_1.projectRepository.update(projectId, data);
        });
    },
    /**
     * Șterge proiectul după ID.
     * Ownership-ul este deja verificat de tenantGuard înainte de apelul acestei metode.
     */
    deleteProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield projectRepository_1.projectRepository.delete(projectId);
        });
    }
};
