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

import { prisma } from '../../lib/prisma';
import { buildContextMultipliers, ProjectContextInput, ConcreteMaterialCode } from '../../core/services/contextMultiplierEngine';
import { extractMetricsFromSnapshot } from '../../lib/planMetricsExtractor';
import { editorRepository } from '../editor/editorRepository';
import { bomRepository } from './bomRepository';
import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { selectMaterialForBOM, MaterialQuery } from './materialSelector';

// ─────────────────────────────────────────────────────────────────
// TIPURI
// ─────────────────────────────────────────────────────────────────

export interface FoundationSpec {
  /** Clasa betonului + clasa de expunere (NE012-1-2022) */
  concreteClass: string;
  /** Adâncimea minimă de fundare în cm (NP112-2014) */
  minDepthCm: number;
  /** Motivul alegerii clasei de beton — injectat în prompt RAG */
  note: string;
}

export interface ProjectMetrics {
  foundationDepthM: number;
  foundationWidthM: number;
  floorsCount: number;
  floorHeightM: number;
  seismicZone: string;
  perimeterM: number;
  totalFloorAreaSqm: number;
  interiorWallsM: number;
  countDoors: number;
  countExteriorDoors: number;
  countInteriorDoors: number;
  countWindows: number;
  exteriorOpeningsSqm: number;
}

// ─────────────────────────────────────────────────────────────────
// FUNCȚIE LEGACY — păstrată pentru compatibilitate cu agentOrchestrator
// (care o folosește în buildRAGContext pentru a determina clasa betonului)
// ─────────────────────────────────────────────────────────────────

export function calcFoundationSpec(
  frostDepthCm: number | null | undefined,
  soilType?: string | null
): FoundationSpec {
  const frost = frostDepthCm ?? 80;
  const severeFrost = frost > 90;
  const concreteClass = severeFrost ? 'C25/30-XF2' : 'C20/25-XC2';
  const minDepthCm = Math.max(frost + 10, 80);
  const note = severeFrost
    ? `Adâncime îngheț ${frost}cm (>90cm) → zonă cu îngheț sever → NE012-1-2022 impune minim C25/30 clasa XF2`
    : `Adâncime îngheț ${frost}cm → îngheț normal → NE012-1-2022 permite C20/25 clasa XC2`;
  return { concreteClass, minDepthCm, note };
}

// ─────────────────────────────────────────────────────────────────
// EVALUATOR DE FORMULE — injectează variabilele în formula din JSON
// ─────────────────────────────────────────────────────────────────

interface FormulaVariables {
  perimeter_m: number;
  foundation_width_m: number;
  foundation_depth_m: number;
  floor_height_m: number;
  floors_count: number;
  total_floor_area_sqm: number;
  interior_walls_m: number;
  exterior_openings_sqm: number;
  count_doors: number;
  count_exterior_doors: number;
  count_interior_doors: number;
  count_windows: number;
  count_corners_and_intersections: number;
  seismic_multiplier: number;
  soil_concrete_multiplier: number;
  base_rebar_kg_per_mc: number;
}

function evaluateFormula(formulaStr: string, vars: FormulaVariables): number {
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

  const result = Function('"use strict"; return (' + expr + ')')() as number;
  if (!isFinite(result) || isNaN(result)) {
    throw new Error(`Formula a produs valoare invalidă (${result}): "${formulaStr}"`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// SERVICIU BOM
// ─────────────────────────────────────────────────────────────────

export const bomService = {

  // ── FUNCȚII DE COMPATIBILITATE (folosite de agentOrchestrator) ──

  getFoundationSpec(
    frostDepthCm: number | null | undefined,
    soilType?: string | null
  ): FoundationSpec {
    return calcFoundationSpec(frostDepthCm, soilType);
  },

  formatForPrompt(spec: FoundationSpec): string {
    return [
      `Clasa beton fundație: ${spec.concreteClass}`,
      `Adâncime minimă fundare: ${spec.minDepthCm} cm`,
      `Motivare: ${spec.note}`,
    ].join('\n');
  },

  // ── CALCUL BOM PRINCIPAL ────────────────────────────────────────

  // In-memory mutex per projectId — previne generare dublă în React StrictMode / double-fetch
  _bomGenerating: new Set<number>(),

  async calculateBOM(projectId: number) {
    // Mutex simplu: dacă e deja în progres pentru acest proiect, returnăm ce avem în DB
    if ((this as any)._bomGenerating.has(projectId)) {
      console.warn(`[BOM] Calcul deja în curs pentru proiect #${projectId}, returnăm cache din DB.`);
      return bomRepository.findByProject(projectId);
    }
    (this as any)._bomGenerating.add(projectId);

    try {
      return await this._calculateBOMInternal(projectId);
    } finally {
      (this as any)._bomGenerating.delete(projectId);
    }
  },

  async _calculateBOMInternal(projectId: number) {
    // 1. Date proiect din DB
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Proiect negăsit (id=${projectId})`);

    const floorsCount = Math.max(1, project.totalFloors || 1);

    // 2. Multiplicatori contextuali (determinist)
    const ctxInput: ProjectContextInput = {
      seismicZone:  project.seismicZone,
      soilType:     project.soilType,
      frostDepthCm: project.frostDepthCm,
      totalFloors:  floorsCount,
      hasBasement:  project.hasBasement,
      houseStyle:   project.houseStyle,
      energyClass:  project.energyClass,
    };
    const ctx = buildContextMultipliers(ctxInput);

    // 3. Extragere metrici din ultimul PlanSnapshot salvat (indiferent dacă e publicat explicit)
    const snapshot = await prisma.planSnapshot.findFirst({
      where: { projectId, floor: 'parter' },
      orderBy: { createdAt: 'desc' },
    });
    if (!snapshot) {
      throw new Error('Nu există un plan 2D salvat. Salvează planul din editor înainte de generarea devizului.');
    }
    const extraction = extractMetricsFromSnapshot(
      snapshot?.planJSON ?? null,
      floorsCount,
      ctx.frost_depth_m,
      ctx.foundation_width_m,
    );

    // 4. Recalculăm count_corners_and_intersections cu datele reale din snapshot
    const ctxWithPlan = buildContextMultipliers(ctxInput, {
      interiorWallsM:     extraction.metrics.interiorWallsM,
      countWindows:       extraction.metrics.countWindows,
      countExteriorDoors: extraction.metrics.countExteriorDoors,
    });

    // 5. Asamblare variabile complete pentru evaluator
    const metrics = extraction.metrics;
    const vars: FormulaVariables = {
      perimeter_m:                    metrics.perimeterM,
      foundation_width_m:             ctxWithPlan.foundation_width_m,
      foundation_depth_m:             ctxWithPlan.frost_depth_m,
      floor_height_m:                 metrics.floorHeightM,
      floors_count:                   floorsCount,
      total_floor_area_sqm:           metrics.totalFloorAreaSqm,
      interior_walls_m:               metrics.interiorWallsM,
      exterior_openings_sqm:          metrics.exteriorOpeningsSqm,
      count_doors:                    metrics.countDoors,
      count_exterior_doors:           metrics.countExteriorDoors,
      count_interior_doors:           metrics.countInteriorDoors,
      count_windows:                  metrics.countWindows,
      count_corners_and_intersections: ctxWithPlan.count_corners_and_intersections,
      seismic_multiplier:             ctxWithPlan.seismic_multiplier,
      soil_concrete_multiplier:       ctxWithPlan.soil_concrete_multiplier,
      base_rebar_kg_per_mc:           ctxWithPlan.base_rebar_kg_per_mc,
    };

    // 6. Log diagnostic
    console.log(`[BOM] Proiect #${projectId} — ${project.seismicZone ?? 'ag?'} | sol: ${project.soilType ?? '?'} | îngheț: ${project.frostDepthCm ?? '?'}cm`);
    console.log(`[BOM] seismic_mult=${ctxWithPlan.seismic_multiplier} | soil_mult=${ctxWithPlan.soil_concrete_multiplier} | beton=${ctxWithPlan.concreteClass}`);
    console.log(`[BOM] ${extraction.fromSnapshot ? '✅ Metrici din snapshot' : '⚠️ Metrici estimate (fără snapshot)'}`);

    // 7. Citim formulele
    const formulasPath = path.join(__dirname, '../../data/bom-formulas.json');
    const formulasJson = JSON.parse(fs.readFileSync(formulasPath, 'utf8'));

    // 8. Citim materialele și override-urile din DB
    const materials = await prisma.material.findMany();
    const overrides = await prisma.projectMaterialOverride.findMany({ where: { projectId } });

    // 9. Evaluăm fiecare formulă
    const bomItems: Prisma.ProjectBOMCreateManyInput[] = [];
    let totalEstimatedCost = 0;

    for (const [formulaKey, formula] of Object.entries<any>(formulasJson)) {
      // Sărim meta-blocul
      if (formulaKey === '_meta') continue;

      try {
        const rawQuantity = evaluateFormula(formula.formula, vars);
        if (!isFinite(rawQuantity) || rawQuantity <= 0) {
          // Cantitate 0 este normală (ex: etaje suplimentare când floors_count=1)
          if (rawQuantity < 0) console.warn(`[BOM] Formula ${formulaKey} a produs cantitate negativă: ${rawQuantity}`);
          continue;
        }

        const quantityWithWaste = rawQuantity * (1 + formula.wastePercent / 100);
        const finalQty = Math.ceil(quantityWithWaste * 100) / 100;

        // 10. Selectăm materialul dinamic folosind materialSelector
        const query: MaterialQuery = formula.materialQuery;
        let material: any = null;

        if (query) {
          // Motorul de upgrade (STRICT_NORMATIVE depinde de acest engineCode)
          let engineCode: string | undefined = undefined;
          if (query.engineKey === 'concreteCode') engineCode = ctxWithPlan.concreteCode;
          if (query.engineKey === 'rebarCode') engineCode = ctxWithPlan.rebarCode;
          // Pt upgrade-uri din materialSelector.ts
          let projectSeismicZoneFloat: number | undefined = undefined;
          if (project.seismicZone) {
             projectSeismicZoneFloat = parseFloat(project.seismicZone.replace('g', ''));
          }

          material = await selectMaterialForBOM(query, (project as any).budgetCategory || 'mediu', engineCode, projectSeismicZoneFloat);
        }

        // Override manual (are prioritate absolută)
        const override = overrides.find(o => o.formulaKey === formulaKey);
        if (override) {
          const overrideMat = materials.find(m => m.id === override.materialId);
          if (overrideMat) material = overrideMat;
        }

        if (!material) {
          console.warn(`[BOM] ❌ Niciun material conform găsit pentru formula "${formulaKey}". (query: ${JSON.stringify(query)})`);
          continue;
        }

        const totalPrice = parseFloat((finalQty * material.pricePerUnit).toFixed(2));
        totalEstimatedCost += totalPrice;
        bomItems.push(buildBOMItem(projectId, material, formula, formulaKey, finalQty, rawQuantity, ctxWithPlan, ''));

      } catch (err: any) {
        console.error(`[BOM] Eroare evaluare "${formulaKey}":`, err.message);
      }
    }

    // 12. Persistență DB în tranzacție atomică
    await prisma.$transaction(async (tx) => {
      await tx.projectBOM.deleteMany({ where: { projectId } });
      if (bomItems.length > 0) {
        await tx.projectBOM.createMany({ data: bomItems });
      }
      await tx.project.update({
        where: { id: projectId },
        data: {
          estimatedCost:  totalEstimatedCost,
          bomGeneratedAt: new Date(),
        },
      });
    });

    console.log(`[BOM] Finalizat: ${bomItems.length} linii, cost total estimat: ${totalEstimatedCost.toFixed(2)} RON`);
    return bomRepository.findByProject(projectId);
  },

  // ── OVERRIDE MANUAL (AI Copilot sau utilizator) ─────────────────

  async updateMaterialOverride(projectId: number, formulaKey: string, newMaterialCode: string) {
    const material = await prisma.material.findUnique({
      where: { internalCode: newMaterialCode },
    });

    if (!material) {
      throw new Error(`Materialul cu codul "${newMaterialCode}" nu există în baza de date. Verificați catalogul.`);
    }

    await prisma.projectMaterialOverride.upsert({
      where:  { projectId_formulaKey: { projectId, formulaKey } },
      update: { materialId: material.id },
      create: { projectId, formulaKey, materialId: material.id },
    });

    // Recalculăm devizul cu noul material
    return this.calculateBOM(projectId);
  },

  // ── HELPER: returnează contextul BOM pentru AI (folosit de agentOrchestrator) ──

  getBOMContextForAI(projectId: number, project: {
    seismicZone?: string | null;
    soilType?: string | null;
    frostDepthCm?: number | null;
    totalFloors?: number | null;
    houseStyle?: string | null;
    energyClass?: string | null;
  }): string {
    const ctx = buildContextMultipliers({
      seismicZone:  project.seismicZone,
      soilType:     project.soilType,
      frostDepthCm: project.frostDepthCm,
      totalFloors:  project.totalFloors,
      houseStyle:   project.houseStyle,
      energyClass:  project.energyClass,
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

function buildBOMItem(
  projectId: number,
  material: { id: number; pricePerUnit: number },
  formula: { phase: string; wastePercent: number; note: string; unit?: string },
  formulaKey: string,
  finalQty: number,
  rawQuantity: number,
  ctx: ReturnType<typeof buildContextMultipliers>,
  extraNote: string
): Prisma.ProjectBOMCreateManyInput {
  const totalPrice = parseFloat((finalQty * material.pricePerUnit).toFixed(2));

  // ─── Nota tehnică internă (pentru deviz complet, log, export) ───
  const noteparts = [
    formula.note,
    `Q_brut=${rawQuantity.toFixed(3)} ${formula.unit ?? ''} × (1+${formula.wastePercent}% rebut) = ${finalQty.toFixed(2)} ${formula.unit ?? ''}`,
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
    phase:      formula.phase,
    formulaKey,
    quantity:   finalQty,
    unitPrice:  material.pricePerUnit,
    totalPrice,
    note:       finalNote,
  };
}
