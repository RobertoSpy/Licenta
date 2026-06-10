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
exports.constructionService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const constructionRepository_1 = require("./constructionRepository");
exports.constructionService = {
    generatePhasesForProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const phasesPath = path_1.default.join(__dirname, '../../data/construction-phases.json');
            if (!fs_1.default.existsSync(phasesPath)) {
                throw new Error('MISSING_JSON_FILE');
            }
            let phasesJson;
            try {
                phasesJson = JSON.parse(fs_1.default.readFileSync(phasesPath, 'utf8'));
            }
            catch (err) {
                throw new Error('MALFORMED_JSON_FILE');
            }
            const phasesToInsert = phasesJson.map((p) => ({
                projectId,
                phaseOrder: p.order,
                name: p.name,
                description: p.description,
                durationDays: p.durationDays,
            }));
            yield constructionRepository_1.constructionRepository.deleteByProject(projectId);
            yield constructionRepository_1.constructionRepository.createMany(phasesToInsert);
            return constructionRepository_1.constructionRepository.getByProject(projectId);
        });
    },
    getProjectPhases(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            let phases = yield constructionRepository_1.constructionRepository.getByProject(projectId);
            if (phases.length === 0) {
                phases = yield this.generatePhasesForProject(projectId);
            }
            return phases;
        });
    },
    completePhase(projectId, phaseOrder) {
        return __awaiter(this, void 0, void 0, function* () {
            const phases = yield constructionRepository_1.constructionRepository.getByProject(projectId);
            const targetPhase = phases.find(p => p.phaseOrder === phaseOrder);
            if (!targetPhase) {
                throw new Error('PHASE_NOT_FOUND');
            }
            if (targetPhase.isCompleted) {
                return targetPhase; // Idempotent
            }
            if (phaseOrder > 1) {
                const prevPhase = phases.find(p => p.phaseOrder === phaseOrder - 1);
                if (!prevPhase || !prevPhase.isCompleted) {
                    throw new Error('PREREQUISITE_NOT_COMPLETED');
                }
            }
            return constructionRepository_1.constructionRepository.markPhaseCompleted(projectId, phaseOrder);
        });
    }
};
