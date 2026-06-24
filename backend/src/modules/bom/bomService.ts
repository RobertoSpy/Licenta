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
  countCorners?: number;
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
  if (!frostDepthCm) {
    return {
      concreteClass: 'Necunoscută',
      minDepthCm: 0,
      note: 'Adâncime îngheț nespecificată → nu se poate determina clasa betonului.',
    };
  }
  const severeFrost = frostDepthCm > 90;
  const concreteClass = severeFrost ? 'C25/30-XF2' : 'C20/25-XC2';
  const minDepthCm = Math.max(frostDepthCm + 10, 80);
  const note = severeFrost
    ? `Adâncime îngheț ${frostDepthCm}cm (>90cm) → zonă cu îngheț sever → NE012-1-2022 impune minim C25/30 clasa XF2`
    : `Adâncime îngheț ${frostDepthCm}cm → îngheț normal → NE012-1-2022 permite C20/25 clasa XC2`;
  return { concreteClass, minDepthCm, note };
}

// ─────────────────────────────────────────────────────────────────
// EVALUATOR DE FORMULE — injectează variabilele în formula din JSON
// ─────────────────────────────────────────────────────────────────

export interface FormulaVariables {
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

export function evaluateFormula(formulaStr: string, vars: FormulaVariables): number {
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

    // 2. Extragere metrici din ultimele PlanSnapshot-uri salvate pentru fiecare etaj
    const floors = ['subsol', 'parter', 'etaj1'];
    const allSnapshots = await Promise.all(
      floors.map(floor => 
        prisma.planSnapshot.findFirst({
          where: { projectId, floor },
          orderBy: { createdAt: 'desc' }
        })
      )
    );
    const validSnapshots = allSnapshots.filter(s => s !== null).map(s => s!.planJSON);

    if (validSnapshots.length === 0) {
      throw new Error('Nu există un plan 2D salvat. Salvează planul din editor înainte de generarea devizului.');
    }

    const extraction = extractMetricsFromSnapshot(
      validSnapshots,
      floorsCount
    );

    // 3. Multiplicatori contextuali (determinist)
    const ctxInput: ProjectContextInput = {
      seismicZone:  project.seismicZone,
      soilType:     project.soilType,
      frostDepthCm: project.frostDepthCm,
      totalFloors:  floorsCount,
      hasBasement:  project.hasBasement,
      houseStyle:   project.houseStyle,
      energyClass:  project.energyClass,
    };

    const ctxWithPlan = buildContextMultipliers(ctxInput, {
      interiorWallsM:     extraction.metrics.interiorWallsM,
      countWindows:       extraction.metrics.countWindows,
      countExteriorDoors: extraction.metrics.countExteriorDoors,
      countCorners:       extraction.metrics.countCorners,
    });

    // 4. Asamblare variabile complete pentru evaluator
    const metrics = extraction.metrics;
    // Injectăm valorile inginerești calculate în metrics
    metrics.foundationDepthM = ctxWithPlan.frost_depth_m;
    metrics.foundationWidthM = ctxWithPlan.foundation_width_m;
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
    console.log(`[BOM] ${extraction.fromSnapshot ? ' Metrici din snapshot' : ' Metrici estimate (fără snapshot)'}`);

    // 7. Citim formulele
    const formulasPath = path.join(__dirname, '../../data/bom-formulas.json');
    const formulasJson = JSON.parse(fs.readFileSync(formulasPath, 'utf8'));

    // 8. Citim materialele și override-urile din DB
    const materials = await prisma.material.findMany();
    const overrides = await prisma.projectMaterialOverride.findMany({ where: { projectId } });

    // ─── Context pentru evaluatorul de upgrades ────────────────────────────────────
    const ag = project.seismicZone ? parseFloat(project.seismicZone.replace('g', '')) : 0;
    const frostDepthCm = project.frostDepthCm ?? 80;
    const isWeakSoil = project.soilType ? /argi|lut|loess|praf|turb|umpl/i.test(project.soilType) : false;
    const upgradeCtx = {
      ag,
      frostDepthCm,
      isWeakSoil,
      houseStyle:  project.houseStyle  ?? '',
      energyClass: project.energyClass ?? '',
    };

    // ─── Construim map: formulaKey → structuralType al materialului ales ────────────────
    // Citim structuralType direct din DB (câmpul nou) — fără regex, fără hardcode.
    const selectedStructuralTypes = new Map<string, string>();
    for (const override of overrides) {
      const mat = materials.find(m => m.id === override.materialId);
      if (mat && (mat as any).structuralType) {
        selectedStructuralTypes.set(override.formulaKey, (mat as any).structuralType);
      }
    }
    // Default pentru wall_exterior: determinat din defaultRoleCode + upgrades
    if (!selectedStructuralTypes.has('wall_exterior')) {
      const wallFormula = formulasJson['wall_exterior'];
      let fallback = 'BCA';
      if (wallFormula?.defaultRoleCode) {
        const resolvedCode = resolveUpgradedMaterialCode(wallFormula, upgradeCtx);
        const defaultMat = materials.find(m => m.subcategory === resolvedCode || m.internalCode === resolvedCode);
        if (defaultMat && (defaultMat as any).structuralType) {
          fallback = (defaultMat as any).structuralType;
        }
      }
      selectedStructuralTypes.set('wall_exterior', fallback);
    }
    console.log(`[BOM] Material structural wall_exterior: ${selectedStructuralTypes.get('wall_exterior')}`);

    // 9. Evaluăm fiecare formulă
    const bomItems: Prisma.ProjectBOMCreateManyInput[] = [];
    let totalEstimatedCost = 0;

    for (const [formulaKey, formula] of Object.entries<any>(formulasJson)) {
      // Sărim meta-blocul
      if (formulaKey === '_meta') continue;

      // ─── Evaluare generică a condiției declarative din JSON ───────────────────────
      // Niciun formulaKey hardcodat — engine-ul evaluează regula descrisă în JSON.
      if (formula.condition) {
        const { formulaKey: refKey, structuralType: required } = formula.condition;
        const actual = selectedStructuralTypes.get(refKey) ?? 'BCA';
        if (actual !== required) continue;
      }

      try {
        const rawQuantity = evaluateFormula(formula.formula, vars);
        if (!isFinite(rawQuantity) || rawQuantity <= 0) {
          if (rawQuantity < 0) console.warn(`[BOM] Formula ${formulaKey} a produs cantitate negativă: ${rawQuantity}`);
          continue;
        }

        const quantityWithWaste = rawQuantity * (1 + formula.wastePercent / 100);
        const finalQty = Math.ceil(quantityWithWaste * 100) / 100;

        // 10. Selectăm materialul — priorități:
        //   1. Override manual (prioritate absolută)
        //   2. defaultMaterialCode + upgrades din JSON (data-driven)
        //   3. materialSelector (NORMATIVE_BUDGET / FREE_PREFERENCE)
        let material: any = null;

        // 10a. Override manual
        const override = overrides.find(o => o.formulaKey === formulaKey);
        if (override) {
          material = materials.find(m => m.id === override.materialId) ?? null;
        }

        // 10b. defaultRoleCode + upgrades (data-driven, fără hardcode în TS)
        if (!material && formula.defaultRoleCode) {
          const resolvedCode = resolveUpgradedMaterialCode(formula, upgradeCtx);
          const isExactCode = resolvedCode.toUpperCase() === resolvedCode && resolvedCode.includes('_');
          const roleQuery: MaterialQuery = isExactCode ? { internalCode: resolvedCode } : { subcategory: resolvedCode };
          material = await selectMaterialForBOM(roleQuery, (project as any).budgetCategory || 'mediu', undefined);
          if (!material) {
            console.warn(`[BOM] Rolul "${resolvedCode}" nu are materiale în catalog.`);
          }
        }

        // 10c. materialSelector (STRICT_NORMATIVE / NORMATIVE_BUDGET / FREE_PREFERENCE)
        if (!material) {
          const query: MaterialQuery = formula.materialQuery;
          if (query) {
            let engineCode: string | undefined = undefined;
            if (query.engineKey === 'concreteCode') engineCode = ctxWithPlan.concreteCode;
            if (query.engineKey === 'rebarCode')    engineCode = ctxWithPlan.rebarCode;
            let projectSeismicZoneFloat: number | undefined = undefined;
            if (project.seismicZone) projectSeismicZoneFloat = ag;
            material = await selectMaterialForBOM(query, (project as any).budgetCategory, engineCode, projectSeismicZoneFloat);
          }
        }

        if (!material) {
          console.warn(`[BOM]   Niciun material conform găsit pentru formula "${formulaKey}". (query: ${JSON.stringify(formula.materialQuery)})`);
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
    }, { 
      // Omit planMetrics aici deoarece acest block de context
      // e gândit doar să informeze agentul AI despre riscurile de șantier.
      countCorners: 4
    });

    return [
      '[MULTIPLICATORI BOM — CALCULAȚI DETERMINIST]',
      `  seismic_multiplier: ${ctx.seismic_multiplier}`,
      `  soil_concrete_multiplier: ${ctx.soil_concrete_multiplier}`,
      `  Clasa beton fundație aplicată automat: ${ctx.concreteClass}`,
      `  foundation_width_m: ${ctx.foundation_width_m}m`,
      `  frost_depth_m: ${ctx.frost_depth_m}m`,
    ].join('\n');
  },
};

// ─────────────────────────────────────────────────────────────────
// HELPER PRIVAT — rezolvă defaultMaterialCode + upgrades din JSON
//
// Evaluează lista de upgrades din bom-formulas.json și returnează
// internalCode-ul materialului potrivit contextului proiectului.
// ZERO hardcodare în TypeScript — toate regulile sunt în JSON.
// ─────────────────────────────────────────────────────────────────

interface UpgradeContext {
  ag: number;
  frostDepthCm: number;
  isWeakSoil: boolean;
  houseStyle: string;
  energyClass: string;
}

function   resolveUpgradedMaterialCode(
  formula: { defaultRoleCode: string; upgrades?: Array<{ if: Record<string, any>; useRoleCode: string }> },
  ctx: UpgradeContext
): string {
  for (const upgrade of (formula.upgrades ?? [])) {
    const cond = upgrade.if;
    // Toate condițiile din obiectul `if` trebuie să fie adevărate (AND logic)
    if (cond.ag_gte           !== undefined && ctx.ag < cond.ag_gte)                        continue;
    if (cond.ag_lt            !== undefined && ctx.ag >= cond.ag_lt)                        continue;
    if (cond.frost_depth_cm_gt !== undefined && ctx.frostDepthCm <= cond.frost_depth_cm_gt) continue;
    if (cond.soil_type_weak   !== undefined && ctx.isWeakSoil !== cond.soil_type_weak)      continue;
    if (cond.energy_class     !== undefined && ctx.energyClass !== cond.energy_class)       continue;
    if (cond.house_style_in   !== undefined && !cond.house_style_in.includes(ctx.houseStyle)) continue;
    // Toate condițiile satisfăcute → prima regulă câștigă
    return upgrade.useRoleCode;
  }
  return formula.defaultRoleCode;
}

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

  // Nota tehnică — DOAR formula normativă + calculul cantității
  // Contextul seismic/sol NU se stochează aici — e disponibil din project.*
  const note = [
    formula.note,
    `Q=${rawQuantity.toFixed(3)} + ${formula.wastePercent}% rebut = ${finalQty.toFixed(2)} ${formula.unit ?? ''}`,
  ].filter(Boolean).join(' | ');

  return {
    projectId,
    materialId: material.id,
    phase:      formula.phase,
    formulaKey,
    quantity:   finalQty,
    unitPrice:  material.pricePerUnit,
    totalPrice,
    note,
  };
}
