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
const conformityService_1 = require("../conformityService");
const conformityRulesCache = __importStar(require("../../../lib/conformityRulesCache"));
jest.mock('../../../lib/conformityRulesCache');
describe('conformityService (unit)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        conformityRulesCache.getSupplementalRules.mockResolvedValue([]);
    });
    describe('Surface Boundaries (Suprafață Minimă)', () => {
        describe('Living (minimum 18.0 sqm)', () => {
            it('living at exactly 18.0sqm returns status ok', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 18.0 }]);
                expect(result.rooms[0].status).toBe('ok');
                expect(result.violations).toHaveLength(0);
            }));
            it('living at 17.99sqm returns status warning (within 90% = 16.2sqm threshold)', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 17.99 }]);
                expect(result.rooms[0].status).toBe('warning');
                expect(result.warnings).toHaveLength(1);
            }));
            it('living at 16.19sqm returns status error (below 90% of 18sqm)', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 16.19 }]);
                expect(result.rooms[0].status).toBe('error');
                expect(result.violations).toHaveLength(1);
            }));
            it('living at 0sqm returns status error, not throws', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 0 }]);
                expect(result.rooms[0].status).toBe('error');
                expect(result.violations).toHaveLength(1);
            }));
        });
        describe('Dormitor (minimum 12.0 sqm, conform JSON)', () => {
            it('dormitor at 12.0sqm returns ok', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Dormitor', usableSqm: 12.0 }]);
                expect(result.rooms[0].status).toBe('ok');
            }));
            it('dormitor la 10.8sqm returns warning', () => __awaiter(void 0, void 0, void 0, function* () {
                // 90% of 12.0 = 10.8
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Dormitor', usableSqm: 10.8 }]);
                expect(result.rooms[0].status).toBe('warning');
            }));
            it('dormitor la 10.79sqm returns error', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Dormitor', usableSqm: 10.79 }]);
                expect(result.rooms[0].status).toBe('error');
            }));
        });
        describe('Unrecognized and Special Labels', () => {
            it('room with unrecognized label returns status ok (no false positives)', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Camera Misterioasa', usableSqm: 2.0 }]);
                expect(result.rooms[0].status).toBe('ok');
            }));
            it('room labeled "Debara" has no minimum surface requirement', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Debara', usableSqm: 5.0 }]);
                expect(result.rooms[0].status).toBe('ok');
            }));
            it('room label matching is case-insensitive ("LIVING" === "living")', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'LIVING', usableSqm: 10.0 }]); // Sub 16.2
                expect(result.rooms[0].status).toBe('error'); // Must catch as Living
            }));
            it('room label with number is normalized correctly ("Dormitor 1" → dormitor)', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Dormitor 1', usableSqm: 5.0 }]); // Sub 8.1
                expect(result.rooms[0].status).toBe('error'); // Must catch as Dormitor
            }));
        });
    });
    describe('Garage Exterior Access Rule', () => {
        it('garage with exterior door element returns no access error', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Garaj', usableSqm: 20, hasExteriorAccess: true }]);
            expect(result.rooms[0].status).toBe('ok');
            expect(result.violations.some(v => v.code === 'ARCH_GARAGE_ACCESS')).toBeFalsy();
        }));
        it('garage with only interior door elements returns GARAGE_NO_EXTERIOR_ACCESS error', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Garaj', usableSqm: 20, hasExteriorAccess: false }]);
            expect(result.rooms[0].status).toBe('error');
            expect(result.violations.some(v => v.code === 'ARCH_GARAGE_ACCESS')).toBeTruthy();
        }));
        it('garage with no door elements returns GARAGE_NO_EXTERIOR_ACCESS error', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Garaj', usableSqm: 20, hasExteriorAccess: false }]);
            expect(result.rooms[0].status).toBe('error');
            expect(result.violations.some(v => v.code === 'ARCH_GARAGE_ACCESS')).toBeTruthy();
        }));
        it('garage rule does not apply to rooms not labeled as garage/garaj', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 20, hasExteriorAccess: false }]);
            expect(result.violations.some(v => v.code === 'ARCH_GARAGE_ACCESS')).toBeFalsy();
        }));
    });
    describe('RAG / getSupplementalRules Mock Isolation', () => {
        it('evaluateRooms does not call getSupplementalRules when all rules are deterministic', () => __awaiter(void 0, void 0, void 0, function* () {
            // O cameră "Living" fără coridoare și fără uși furnizate -> e pur determinist
            yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Living', usableSqm: 20 }]);
            expect(conformityRulesCache.getSupplementalRules).not.toHaveBeenCalled();
        }));
        it('evaluateRooms completes successfully when getSupplementalRules mock returns empty array', () => __awaiter(void 0, void 0, void 0, function* () {
            // Declanșăm RAG prin adăugarea unui coridor
            conformityRulesCache.getSupplementalRules.mockResolvedValue([]);
            const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Coridor', usableSqm: 10, widthM: 1.0, heightM: 5.0 }]);
            expect(conformityRulesCache.getSupplementalRules).toHaveBeenCalled();
            // Verificăm dacă fallback-ul JSON pt coridor e aplicat (minim 1.2m vs 1.0m din test)
            expect(result.rooms[0].status).toBe('error');
            expect(result.violations[0].code).toBe('L114_CORRIDOR_WIDTH');
        }));
        it('evaluateRooms does not throw when getSupplementalRules mock throws (graceful degradation)', () => __awaiter(void 0, void 0, void 0, function* () {
            conformityRulesCache.getSupplementalRules.mockRejectedValue(new Error('AI Service Down'));
            const result = yield conformityService_1.conformityService.evaluateRooms([{ id: '1', label: 'Hol', usableSqm: 10, widthM: 1.0, heightM: 5.0 }]);
            // Chiar dacă aruncă RAG-ul, ar trebui să folosească fallback JSON
            expect(result.rooms[0].status).toBe('error');
            expect(result.violations[0].code).toBe('L114_CORRIDOR_WIDTH');
        }));
    });
});
