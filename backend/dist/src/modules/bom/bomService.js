"use strict";
// backend/src/services/bomService.ts
//
// BOM = Bill of Materials — Context-Aware Rule Engine.
//
// ARHITECTURA:
//   • contextMultiplierEngine.ts  → calculează multiplicatorii seismic + sol (determinist)
//   • planMetricsExtractor.ts     → extrage metrici reale din PlanSnapshot
//   • bom-formulas.json           → formulele parametrice (SSOT)
//   • Acest fișier                → asamblare + evaluare + persistență DB
//
//   AI-ul NU decide clasa betonului sau multiplicatorii — el EXPLICĂ ce s-a calculat
//   și poate sugera override-uri pe liniile marcate aiSuggestible=true.
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
exports.bomService = void 0;
exports.calcFoundationSpec = calcFoundationSpec;
exports.evaluateFormula = evaluateFormula;
const prisma_1 = require("../../lib/prisma");
const contextMultiplierEngine_1 = require("../../core/services/contextMultiplierEngine");
const planMetricsExtractor_1 = require("../../lib/planMetricsExtractor");
const bomRepository_1 = require("./bomRepository");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const materialSelector_1 = require("./materialSelector");
// ─────────────────────────────────────────────────────────────────
// FUNCȚIE LEGACY — păstrată pentru compatibilitate cu agentOrchestrator
// (care o folosește în buildRAGContext pentru a determina clasa betonului)
// ─────────────────────────────────────────────────────────────────
function calcFoundationSpec(frostDepthCm, soilType) {
    const frost = frostDepthCm !== null && frostDepthCm !== void 0 ? frostDepthCm : 80;
    const severeFrost = frost > 90;
    const concreteClass = severeFrost ? 'C25/30-XF2' : 'C20/25-XC2';
    const minDepthCm = Math.max(frost + 10, 80);
    const note = severeFrost
        ? `Adâncime îngheț ${frost}cm (>90cm) → zonă cu îngheț sever → NE012-1-2022 impune minim C25/30 clasa XF2`
        : `Adâncime îngheț ${frost}cm → îngheț normal → NE012-1-2022 permite C20/25 clasa XC2`;
    return { concreteClass, minDepthCm, note };
}
function evaluateFormula(formulaStr, vars) {
    // Substituire ordonată: nume mai lungi înainte (evităm suprascrierea parțială)
    let expr = formulaStr
        .replace(/soil_concrete_multiplier/g, vars.soil_concrete_multiplier.toString())
        .replace(/base_rebar_kg_per_mc/g, vars.base_rebar_kg_per_mc.toString())
        .replace(/seismic_multiplier/g, vars.seismic_multiplier.toString())
        .replace(/count_corners_and_intersections/g, vars.count_corners_and_intersections.toString())
        .replace(/exterior_openings_sqm/g, vars.exterior_openings_sqm.toString())
        .replace(/count_exterior_doors/g, vars.count_exterior_doors.toString())
        .replace(/count_interior_doors/g, vars.count_interior_doors.toString())
        .replace(/total_floor_area_sqm/g, vars.total_floor_area_sqm.toString())
        .replace(/foundation_width_m/g, vars.foundation_width_m.toString())
        .replace(/foundation_depth_m/g, vars.foundation_depth_m.toString())
        .replace(/interior_walls_m/g, vars.interior_walls_m.toString())
        .replace(/count_windows/g, vars.count_windows.toString())
        .replace(/floor_height_m/g, vars.floor_height_m.toString())
        .replace(/floors_count/g, vars.floors_count.toString())
        .replace(/count_doors/g, vars.count_doors.toString())
        .replace(/perimeter_m/g, vars.perimeter_m.toString());
    // Whitelist strictă: doar cifre, spații, operatori matematici și paranteze
    if (!/^[\d\s+\-*/.()\[\]]+$/.test(expr)) {
        throw new Error(`Formula nesigură după substituție: "${expr}" (originală: "${formulaStr}")`);
    }
    const result = Function('"use strict"; return (' + expr + ')')();
    if (!isFinite(result) || isNaN(result)) {
        throw new Error(`Formula a produs valoare invalidă (${result}): "${formulaStr}"`);
    }
    return result;
}
// ─────────────────────────────────────────────────────────────────
// SERVICIU BOM
// ─────────────────────────────────────────────────────────────────
exports.bomService = {
    // ── FUNCȚII DE COMPATIBILITATE (folosite de agentOrchestrator) ──
    getFoundationSpec(frostDepthCm, soilType) {
        return calcFoundationSpec(frostDepthCm, soilType);
    },
    formatForPrompt(spec) {
        return [
            `Clasa beton fundație: ${spec.concreteClass}`,
            `Adâncime minimă fundare: ${spec.minDepthCm} cm`,
            `Motivare: ${spec.note}`,
        ].join('\n');
    },
    // ── CALCUL BOM PRINCIPAL ────────────────────────────────────────
    // In-memory mutex per projectId — previne generare dublă în React StrictMode / double-fetch
    _bomGenerating: new Set(),
    calculateBOM(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Mutex simplu: dacă e deja în progres pentru acest proiect, returnăm ce avem în DB
            if (this._bomGenerating.has(projectId)) {
                console.warn(`[BOM] Calcul deja în curs pentru proiect #${projectId}, returnăm cache din DB.`);
                return bomRepository_1.bomRepository.findByProject(projectId);
            }
            this._bomGenerating.add(projectId);
            try {
                return yield this._calculateBOMInternal(projectId);
            }
            finally {
                this._bomGenerating.delete(projectId);
            }
        });
    },
    _calculateBOMInternal(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            // 1. Date proiect din DB
            const project = yield prisma_1.prisma.project.findUnique({ where: { id: projectId } });
            if (!project)
                throw new Error(`Proiect negăsit (id=${projectId})`);
            const floorsCount = Math.max(1, project.totalFloors || 1);
            // 2. Multiplicatori contextuali (determinist)
            const ctxInput = {
                seismicZone: project.seismicZone,
                soilType: project.soilType,
                frostDepthCm: project.frostDepthCm,
                totalFloors: floorsCount,
                hasBasement: project.hasBasement,
                houseStyle: project.houseStyle,
                energyClass: project.energyClass,
            };
            const ctx = (0, contextMultiplierEngine_1.buildContextMultipliers)(ctxInput);
            // 3. Extragere metrici din ultimul PlanSnapshot salvat (indiferent dacă e publicat explicit)
            const snapshot = yield prisma_1.prisma.planSnapshot.findFirst({
                where: { projectId, floor: 'parter' },
                orderBy: { createdAt: 'desc' },
            });
            if (!snapshot) {
                throw new Error('Nu există un plan 2D salvat. Salvează planul din editor înainte de generarea devizului.');
            }
            const extraction = (0, planMetricsExtractor_1.extractMetricsFromSnapshot)((_a = snapshot === null || snapshot === void 0 ? void 0 : snapshot.planJSON) !== null && _a !== void 0 ? _a : null, floorsCount, ctx.frost_depth_m, ctx.foundation_width_m);
            // 4. Recalculăm count_corners_and_intersections cu datele reale din snapshot
            const ctxWithPlan = (0, contextMultiplierEngine_1.buildContextMultipliers)(ctxInput, {
                interiorWallsM: extraction.metrics.interiorWallsM,
                countWindows: extraction.metrics.countWindows,
                countExteriorDoors: extraction.metrics.countExteriorDoors,
            });
            // 5. Asamblare variabile complete pentru evaluator
            const metrics = extraction.metrics;
            const vars = {
                perimeter_m: metrics.perimeterM,
                foundation_width_m: ctxWithPlan.foundation_width_m,
                foundation_depth_m: ctxWithPlan.frost_depth_m,
                floor_height_m: metrics.floorHeightM,
                floors_count: floorsCount,
                total_floor_area_sqm: metrics.totalFloorAreaSqm,
                interior_walls_m: metrics.interiorWallsM,
                exterior_openings_sqm: metrics.exteriorOpeningsSqm,
                count_doors: metrics.countDoors,
                count_exterior_doors: metrics.countExteriorDoors,
                count_interior_doors: metrics.countInteriorDoors,
                count_windows: metrics.countWindows,
                count_corners_and_intersections: ctxWithPlan.count_corners_and_intersections,
                seismic_multiplier: ctxWithPlan.seismic_multiplier,
                soil_concrete_multiplier: ctxWithPlan.soil_concrete_multiplier,
                base_rebar_kg_per_mc: ctxWithPlan.base_rebar_kg_per_mc,
            };
            // 6. Log diagnostic
            console.log(`[BOM] Proiect #${projectId} — ${(_b = project.seismicZone) !== null && _b !== void 0 ? _b : 'ag?'} | sol: ${(_c = project.soilType) !== null && _c !== void 0 ? _c : '?'} | îngheț: ${(_d = project.frostDepthCm) !== null && _d !== void 0 ? _d : '?'}cm`);
            console.log(`[BOM] seismic_mult=${ctxWithPlan.seismic_multiplier} | soil_mult=${ctxWithPlan.soil_concrete_multiplier} | beton=${ctxWithPlan.concreteClass}`);
            console.log(`[BOM] ${extraction.fromSnapshot ? '✅ Metrici din snapshot' : '⚠️ Metrici estimate (fără snapshot)'}`);
            // 7. Citim formulele
            const formulasPath = path_1.default.join(__dirname, '../../data/bom-formulas.json');
            const formulasJson = JSON.parse(fs_1.default.readFileSync(formulasPath, 'utf8'));
            // 8. Citim materialele și override-urile din DB
            const materials = yield prisma_1.prisma.material.findMany();
            const overrides = yield prisma_1.prisma.projectMaterialOverride.findMany({ where: { projectId } });
            // 9. Evaluăm fiecare formulă
            const bomItems = [];
            let totalEstimatedCost = 0;
            for (const [formulaKey, formula] of Object.entries(formulasJson)) {
                // Sărim meta-blocul
                if (formulaKey === '_meta')
                    continue;
                try {
                    const rawQuantity = evaluateFormula(formula.formula, vars);
                    if (!isFinite(rawQuantity) || rawQuantity <= 0) {
                        // Cantitate 0 este normală (ex: etaje suplimentare când floors_count=1)
                        if (rawQuantity < 0)
                            console.warn(`[BOM] Formula ${formulaKey} a produs cantitate negativă: ${rawQuantity}`);
                        continue;
                    }
                    const quantityWithWaste = rawQuantity * (1 + formula.wastePercent / 100);
                    const finalQty = Math.ceil(quantityWithWaste * 100) / 100;
                    // 10. Selectăm materialul dinamic folosind materialSelector
                    const query = formula.materialQuery;
                    let material = null;
                    if (query) {
                        // Motorul de upgrade (STRICT_NORMATIVE depinde de acest engineCode)
                        let engineCode = undefined;
                        if (query.engineKey === 'concreteCode')
                            engineCode = ctxWithPlan.concreteCode;
                        if (query.engineKey === 'rebarCode')
                            engineCode = ctxWithPlan.rebarCode;
                        // Pt upgrade-uri din materialSelector.ts
                        let projectSeismicZoneFloat = undefined;
                        if (project.seismicZone) {
                            projectSeismicZoneFloat = parseFloat(project.seismicZone.replace('g', ''));
                        }
                        material = yield (0, materialSelector_1.selectMaterialForBOM)(query, project.budgetCategory || 'mediu', engineCode, projectSeismicZoneFloat);
                    }
                    // Override manual (are prioritate absolută)
                    const override = overrides.find(o => o.formulaKey === formulaKey);
                    if (override) {
                        const overrideMat = materials.find(m => m.id === override.materialId);
                        if (overrideMat)
                            material = overrideMat;
                    }
                    if (!material) {
                        console.warn(`[BOM] ❌ Niciun material conform găsit pentru formula "${formulaKey}". (query: ${JSON.stringify(query)})`);
                        continue;
                    }
                    const totalPrice = parseFloat((finalQty * material.pricePerUnit).toFixed(2));
                    totalEstimatedCost += totalPrice;
                    bomItems.push(buildBOMItem(projectId, material, formula, formulaKey, finalQty, rawQuantity, ctxWithPlan, ''));
                }
                catch (err) {
                    console.error(`[BOM] Eroare evaluare "${formulaKey}":`, err.message);
                }
            }
            // 12. Persistență DB în tranzacție atomică
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield tx.projectBOM.deleteMany({ where: { projectId } });
                if (bomItems.length > 0) {
                    yield tx.projectBOM.createMany({ data: bomItems });
                }
                yield tx.project.update({
                    where: { id: projectId },
                    data: {
                        estimatedCost: totalEstimatedCost,
                        bomGeneratedAt: new Date(),
                    },
                });
            }));
            console.log(`[BOM] Finalizat: ${bomItems.length} linii, cost total estimat: ${totalEstimatedCost.toFixed(2)} RON`);
            return bomRepository_1.bomRepository.findByProject(projectId);
        });
    },
    // ── OVERRIDE MANUAL (AI Copilot sau utilizator) ─────────────────
    updateMaterialOverride(projectId, formulaKey, newMaterialCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const material = yield prisma_1.prisma.material.findUnique({
                where: { internalCode: newMaterialCode },
            });
            if (!material) {
                throw new Error(`Materialul cu codul "${newMaterialCode}" nu există în baza de date. Verificați catalogul.`);
            }
            yield prisma_1.prisma.projectMaterialOverride.upsert({
                where: { projectId_formulaKey: { projectId, formulaKey } },
                update: { materialId: material.id },
                create: { projectId, formulaKey, materialId: material.id },
            });
            // Recalculăm devizul cu noul material
            return this.calculateBOM(projectId);
        });
    },
    // ── HELPER: returnează contextul BOM pentru AI (folosit de agentOrchestrator) ──
    getBOMContextForAI(projectId, project) {
        const ctx = (0, contextMultiplierEngine_1.buildContextMultipliers)({
            seismicZone: project.seismicZone,
            soilType: project.soilType,
            frostDepthCm: project.frostDepthCm,
            totalFloors: project.totalFloors,
            houseStyle: project.houseStyle,
            energyClass: project.energyClass,
        });
        return [
            '[MULTIPLICATORI BOM — CALCULAȚI DETERMINIST]',
            `  seismic_multiplier: ${ctx.seismic_multiplier} (${ctx.seismic_note})`,
            `  soil_concrete_multiplier: ${ctx.soil_concrete_multiplier} (${ctx.soil_note})`,
            `  Clasa beton fundație aplicată automat: ${ctx.concreteClass} (${ctx.concrete_note})`,
            `  foundation_width_m: ${ctx.foundation_width_m}m`,
            `  frost_depth_m: ${ctx.frost_depth_m}m`,
        ].join('\n');
    },
};
// ─────────────────────────────────────────────────────────────────
// HELPER PRIVAT — construiește un item BOM cu nota completă
//                 și explicația accesibilă (normativă + simplă)
// ─────────────────────────────────────────────────────────────────
function buildBOMItem(projectId, material, formula, formulaKey, finalQty, rawQuantity, ctx, extraNote) {
    var _a, _b;
    const totalPrice = parseFloat((finalQty * material.pricePerUnit).toFixed(2));
    // ─── Nota tehnică internă (pentru deviz complet, log, export) ───
    const noteparts = [
        formula.note,
        `Q_brut=${rawQuantity.toFixed(3)} ${(_a = formula.unit) !== null && _a !== void 0 ? _a : ''} × (1+${formula.wastePercent}% rebut) = ${finalQty.toFixed(2)} ${(_b = formula.unit) !== null && _b !== void 0 ? _b : ''}`,
        ctx.seismic_multiplier !== 1.0 ? ctx.seismic_note : null,
        ctx.soil_concrete_multiplier !== 1.0 ? ctx.soil_note : null,
        extraNote || null,
    ].filter(Boolean).join(' | ');
    // ─── Explicație afișată în UI — tehnică + accesibilă ────────────
    const finalNote = formula.note
        ? `${noteparts} ||EXPLAIN|| 📐 ${formula.note}`
        : noteparts;
    return {
        projectId,
        materialId: material.id,
        phase: formula.phase,
        formulaKey,
        quantity: finalQty,
        unitPrice: material.pricePerUnit,
        totalPrice,
        note: finalNote,
    };
}
