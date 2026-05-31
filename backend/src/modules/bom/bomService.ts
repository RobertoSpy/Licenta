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
      `Clasa beton fundație: ${spec.concreteClass} (NE012-1-2022, Tab. 4.1)`,
      `Adâncime minimă fundare: ${spec.minDepthCm} cm (NP112-2014)`,
      `Motivare: ${spec.note}`,
    ].join('\n');
  },

  // ── CALCUL BOM PRINCIPAL ────────────────────────────────────────

  async calculateBOM(projectId: number) {
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
      houseStyle:   project.houseStyle,
      energyClass:  project.energyClass,
    };
    const ctx = buildContextMultipliers(ctxInput);

    // 3. Extragere metrici din PlanSnapshot publicat
    const snapshot = await prisma.planSnapshot.findFirst({
      where: { projectId, floor: 'parter', isPublished: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!snapshot) {
      throw new Error('Nu există un plan 2D publicat. Publică planul din editor înainte de generarea devizului.');
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

        // 10. Selectăm materialul:
        //   Prioritate 1: override explicit din DB (utilizatorul/AI-ul a schimbat)
        //   Prioritate 2: clasa de beton selectată automat de contextMultiplierEngine
        //   Prioritate 3: defaultMaterialCode din formulă
        let materialCodeToUse: string = formula.defaultMaterialCode;

        // Clasa betonului auto-upgrade (Problema 3 din review)
        const isConcreteFormula = [
          'foundation_concrete',
          'structure_pillars_concrete',
          'structure_tie_beams_concrete',
          'slab_concrete',
        ].includes(formulaKey);

        if (isConcreteFormula && ctxWithPlan.concreteCode !== 'STANDARD_BETON_C20_25') {
          materialCodeToUse = ctxWithPlan.concreteCode;
        }

        // Auto-upgrade inteligent pentru materiale (seismic, clima, stil)
        if (formulaKey === 'wall_exterior' && ctxWithPlan.exteriorWallCode !== 'STANDARD_BCA_25') {
          materialCodeToUse = ctxWithPlan.exteriorWallCode;
        } else if (formulaKey === 'windows' && ctxWithPlan.windowsCode !== 'STANDARD_FEREASTRA_PVC') {
          materialCodeToUse = ctxWithPlan.windowsCode;
        } else if (formulaKey === 'insulation_roof' && ctxWithPlan.insulationRoofCode !== 'vata-minerala-15cm') {
          materialCodeToUse = ctxWithPlan.insulationRoofCode;
        } else if (formulaKey === 'foundation_rebar' && ctxWithPlan.rebarCode !== 'STANDARD_FIER_12') {
          materialCodeToUse = ctxWithPlan.rebarCode;
        }

        // Override manual (are prioritate peste auto-upgrade)
        const override = overrides.find(o => o.formulaKey === formulaKey);
        if (override) {
          const overrideMat = materials.find(m => m.id === override.materialId);
          if (overrideMat) materialCodeToUse = overrideMat.internalCode;
        }

        // 11. Căutăm materialul în catalog
        const material = materials.find(m => m.internalCode === materialCodeToUse);
        if (!material) {
          // Fallback explicit la C20/25 dacă C25/30 lipsește (Problema 3 din review)
          if (materialCodeToUse === 'STANDARD_BETON_C25_30') {
            const fallback = materials.find(m => m.internalCode === 'STANDARD_BETON_C20_25');
            if (fallback) {
              console.error(`[BOM] ❌ STANDARD_BETON_C25_30 lipsă în catalog → fallback C20/25 pentru ${formulaKey}. Rulați seedBaselineMaterials.`);
              // Continuăm cu fallback-ul
              const totalPrice = parseFloat((finalQty * fallback.pricePerUnit).toFixed(2));
              totalEstimatedCost += totalPrice;
              bomItems.push(buildBOMItem(projectId, fallback, formula, formulaKey, finalQty, rawQuantity, ctxWithPlan, '⚠️ FALLBACK C20/25 (C25/30 lipsă catalog)'));
            } else {
              console.error(`[BOM] ❌ Atât STANDARD_BETON_C25_30 cât și STANDARD_BETON_C20_25 lipsesc! Sărim ${formulaKey}.`);
            }
          } else {
            console.warn(`[BOM] Material lipsă: "${materialCodeToUse}" pentru formula "${formulaKey}". Rulați seedBaselineMaterials.`);
          }
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
      '',
      'Când discuți despre fundație sau armătură, citează acești coeficienți.',
      'Nu recalcula aceste valori — sunt determinate normativ.',
    ].join('\n');
  },
};

// ─────────────────────────────────────────────────────────────────
// EXPLICAȚII ACCESIBILE — fiecare formulă are:
//   • normativeCitation: referința exactă din normativ (pentru inginer/comisie)
//   • plainExplanation:  ce înseamnă asta în limbaj simplu (pentru orice user)
// ─────────────────────────────────────────────────────────────────

const PLAIN_EXPLANATIONS: Record<string, { normativeCitation: string; plainExplanation: string }> = {
  foundation_concrete: {
    normativeCitation: 'NE 012-1:2022 Tab.5.2 + NP 112-2014',
    plainExplanation: 'Betonul fundației trebuie să fie suficient de rezistent pentru a ține casa stabilă zeci de ani. Cu cât solul e mai slab sau zona mai seismică, cu atât normativul cere un beton mai bun.',
  },
  foundation_rebar: {
    normativeCitation: 'P100-1/2013 Cap.8 + NE 012-1:2022 Tab.E.1',
    plainExplanation: 'Fierul din fundație (armătura) preia forțele seismice și împiedică crăparea betonului. Cantitatea crește automat dacă ești în zonă seismică.',
  },
  foundation_formwork: {
    normativeCitation: 'NE 012-1:2022 §4 — execuție cofraje',
    plainExplanation: 'Cofrajele sunt panourile temporare din lemn care dau forma betonului înainte să se întărească. Se calculează după suprafața laterală a fundației.',
  },
  foundation_waterproofing: {
    normativeCitation: 'NP 112-2014 Art.9 — hidroizolație fundație',
    plainExplanation: 'Membrana bituminoasă protejează fundația de apa din pământ. Fără ea, apa intră în beton și îl degradează în câțiva ani.',
  },
  foundation_sand_bed: {
    normativeCitation: 'NP 112-2014 Art.6.3',
    plainExplanation: 'Stratul de balast de 20cm sub fundație distribuie uniform greutatea casei și permite scurgerea apei. Este obligatoriu — fără el fundația s-ar putea tasă inegal.',
  },
  foundation_leveling_concrete: {
    normativeCitation: 'NE 012-1:2022 §4.3',
    plainExplanation: 'Betonul de egalizare (B100) este un strat subțire de 10cm care creează o suprafață plană sub fundație. Fără el, cofrajele și armătura nu pot fi montate corect.',
  },
  foundation_moisture_barrier: {
    normativeCitation: 'NP 112-2014 Art.9.1 + C 112-86',
    plainExplanation: 'Folia de polietilenă împiedică apa din pământ să ajungă la betonul proaspăt înainte de a se întări. Este o protecție simplă dar esențială.',
  },
  foundation_bitumen_primer: {
    normativeCitation: 'NP 112-2014 Art.9.2 + C 112-86',
    plainExplanation: 'Amorsajul bituminos este ca un "grund" aplicat pe beton înainte de membrana impermeabilă — asigură că membrana lipește bine și nu se dezlipește în timp.',
  },
  wall_exterior: {
    normativeCitation: 'CR 6-2013 §4 + Mc-001-2022 Tab.3',
    plainExplanation: 'Peretele exterior este "coaja" casei. Materialul ales (BCA sau cărămidă) determină cât de bine ține căldura în casă iarna și cât de rezistent e la cutremur.',
  },
  wall_interior: {
    normativeCitation: 'CR 6-2013 §4 + NP 057-2002 Art.6',
    plainExplanation: 'Pereții interiori despart camerele. Sunt mai subțiri decât cei exteriori, dar trebuie totuși să fie stabili și să ofere izolație fonică între camere.',
  },
  mortar_masonry: {
    normativeCitation: 'CR 6-2013 Tab.3.1 §3.2.2',
    plainExplanation: 'Mortarul (sau adezivul la BCA) ține cărămizile/blocurile lipite între ele. Tipul de mortar depinde de materialul ales — BCA necesită un adeziv special cu rost subțire de 1-3mm.',
  },
  structure_pillars_concrete: {
    normativeCitation: 'CR 6-2013 Art.7.4 + P100-1/2013',
    plainExplanation: 'Stâlpișorii de beton armat (buiandrugi verticali) fixează zidăria și preiau forțele seismice. Fără ei, pereții s-ar crăpa la primul cutremur.',
  },
  structure_pillars_rebar: {
    normativeCitation: 'CR 6-2013 Art.7.4 + P100-1/2013 Cap.8',
    plainExplanation: 'Armătura din stâlpișori este „scheletul" care preia forțele de tracțiune — betonul singur e rezistent la compresiune, dar nu la tensiuni. Fierul compensează.',
  },
  structure_tie_beams_concrete: {
    normativeCitation: 'CR 6-2013 Art.7.5',
    plainExplanation: 'Centurile sunt grinzi orizontale de beton armat care „leagă" toți pereții la fiecare nivel. Ele fac casa să se comporte ca un singur corp la cutremur.',
  },
  structure_tie_beams_rebar: {
    normativeCitation: 'CR 6-2013 Art.7.5 + P100-1/2013',
    plainExplanation: 'Armătura din centuri este continuă pe tot perimetrul casei — practic „brățara" din oțel care ține totul unit.',
  },
  slab_concrete: {
    normativeCitation: 'NE 012-1:2022 + CR 0-2012',
    plainExplanation: 'Planșeul (placa de beton) este „podeaua" turnată între etaje. Susține mobila, oamenii, și izolează fonic între niveluri.',
  },
  slab_rebar: {
    normativeCitation: 'CR 0-2012 + NE 012-1:2022 Tab.5.2',
    plainExplanation: 'Armătura din planșeu asigură că placa nu se fisurează sub greutate. Este calculată la greutatea maximă posibilă a etajului.',
  },
  slab_formwork: {
    normativeCitation: 'NE 012-1:2022 §4',
    plainExplanation: 'Cofrajul susține betonul planșeului până se întărește (minim 28 zile). De obicei se folosesc panouri de lemn sau sisteme metalice refolosibile.',
  },
  roof_timber: {
    normativeCitation: 'CR 1-1-4-2012 Art.6 + NP 005-2003',
    plainExplanation: 'Lemnul șarpantei formează structura acoperișului. Grosimea și distanța dintre grinzi depind de greutatea învelitorii și de vântul din zona ta.',
  },
  roof_area: {
    normativeCitation: 'CR 1-1-4-2012 Art.6',
    plainExplanation: 'Suprafața învelitorii este întotdeauna mai mare decât suprafața casei — panta acoperișului adaugă extra metraj. Ai ales tipul de învelitoare (țiglă, tablă) — aceasta este cantitatea necesară.',
  },
  roof_batten: {
    normativeCitation: 'CR 1-1-4-2012 Art.6 + fișe tehnice Tondach/Bramac',
    plainExplanation: 'Șipcile sunt șinele de lemn pe care se prind țiglele sau tabla. Se montează la 33cm distanță una de alta — standardul producătorilor de țiglă.',
  },
  roof_underlay: {
    normativeCitation: 'Mc-001-2022 §7.3 + SR EN 13859-1',
    plainExplanation: 'Folia anticondens este un strat respirant sub țigle care lasă vaporii să iasă dar nu lasă apa să intre. Fără ea, condensul din pod putrezește lemnul șarpantei.',
  },
  roof_gutter: {
    normativeCitation: 'CR 1-1-4-2012 Art.6.3',
    plainExplanation: 'Jgheabul colectează apa de ploaie de pe acoperiș și o dirijează la burlane. Fără el, apa cade direct pe fundație și o degradează în timp.',
  },
  roof_downpipe: {
    normativeCitation: 'CR 1-1-4-2012 Art.6.3',
    plainExplanation: 'Burlanele transportă apa de la jgheab în sol sau în sistemul de canalizare pluvial. Un burlan Ø80mm poate prelua apa de pe max 50mp de acoperiș.',
  },
  insulation_exterior_walls: {
    normativeCitation: 'Mc-001-2022 §7.2 + Legea 372/2005',
    plainExplanation: 'Termoizolația exterioară (polistiren sau vată) reduce factura la încălzire cu 30-50%. Grosimea minimă e impusă prin lege pentru clădirile noi.',
  },
  insulation_roof: {
    normativeCitation: 'Mc-001-2022 §7.3',
    plainExplanation: 'Vata din pod izolează cel mai bine — căldura urcă, iar fără izolație 30% din energia de încălzire se pierde prin acoperiș.',
  },
  etics_mesh: {
    normativeCitation: 'ST 011-2014 §5.3',
    plainExplanation: 'Plasa de fibră de sticlă este „armătura" sistemului de termoizolație exterior. Fără ea, tencuiala decorativă s-ar fisura la primul îngheț.',
  },
  etics_finish: {
    normativeCitation: 'ST 011-2014 §5.5 + Mc-001-2022 §7.2',
    plainExplanation: 'Tencuiala decorativă este finisajul exterior al casei — ce se vede din stradă. Tipul siloxanic respinge apa și nu se mucegăiește.',
  },
  floor_screed: {
    normativeCitation: 'NE 012-1:2022 + SR EN 13813',
    plainExplanation: 'Șapa este stratul neted de ciment turnat pe planșeu, pe care se pun parchetul sau gresia. O șapă bună asigură că podeaua nu va "pocni" sau crăpa.',
  },
  wall_plaster: {
    normativeCitation: 'SR EN 998-1:2017 (tencuieli)',
    plainExplanation: 'Tencuiala acoperă zidăria brută și creează suprafețele netede pe care se aplică gletul și vopseaua. Este prima operație de finisaj interior.',
  },
  glet_interior: {
    normativeCitation: 'SR EN 13279-1 — spec. Knauf Multifinish',
    plainExplanation: 'Gletul este stratul fin alb aplicat peste tencuială, care face peretele perfect neted pentru vopsea. Fără glet, vopseaua scoate în evidență orice neregularitate.',
  },
  paint_interior: {
    normativeCitation: 'SR EN 13300 — spec. Kober Spor',
    plainExplanation: 'Vopseaua lavabilă finalizează interiorul casei. „Lavabilă" înseamnă că se poate spăla cu apă — esențial în bucătărie, baie și camerele copiilor.',
  },
  windows: {
    normativeCitation: 'SR EN 14351-1 + Mc-001-2022 Tab.4',
    plainExplanation: 'Ferestrele triple (3K) pierd de 3 ori mai puțină căldură față de ferestrele simple. Norma impune un coeficient termic maxim (Uw) pentru clădiri noi.',
  },
  door_exterior: {
    normativeCitation: 'SR EN 14351-1 + NP 057-2002 Art.4',
    plainExplanation: 'Ușa exterioară trebuie să fie etanșă la aer și apă, termoizolată și sigură. Dimensiunea minimă e impusă normativ pentru a permite trecerea cu mobila.',
  },
  door_interior: {
    normativeCitation: 'NP 057-2002 Art.4 + NP 063-2002 (acces PMR)',
    plainExplanation: 'Ușile interioare sunt dimensionate să permită trecerea confortabilă. Dacă e cazul, lățimea minimă pentru accesibilitate PMR (persoane cu dizabilități) este de 90cm.',
  },
  electrical_cable_prize: {
    normativeCitation: 'I 7-2011 §5',
    plainExplanation: 'Cablul de prize CYY-F 3×2.5mm² este standardul pentru toate prizele din casă. 3×2.5 înseamnă 3 fire (fază, nul, împământare) de 2.5mm² fiecare — suficient pentru 2500W per circuit.',
  },
  electrical_cable_light: {
    normativeCitation: 'I 7-2011 §5',
    plainExplanation: 'Circuitul de iluminat folosește un cablu mai subțire (1.5mm²) — becurile consumă mult mai puțin decât prizele, deci firul poate fi mai mic.',
  },
  electrical_conduit: {
    normativeCitation: 'I 7-2011 Tab.4.1',
    plainExplanation: 'Tubul de protecție PVC protejează cablurile electrice sub tencuială. Dacă mai târziu trebuie să schimbi cablul, îl scoți prin tub fără să spargi peretele.',
  },
  plumbing_supply: {
    normativeCitation: 'I 9-2022 §8.3 + SR EN ISO 15874',
    plainExplanation: 'Țevile PPR transportă apa rece și caldă în casă. PPR este un plastic special rezistent la temperaturi de până la 95°C — nu ruginesc și durează zeci de ani.',
  },
  plumbing_drainage_main: {
    normativeCitation: 'I 9-2022 §13.3 + SR EN 12056-2',
    plainExplanation: 'Coloana de canalizare Ø110mm este „autostrada" prin care merg toate apele uzate din casă. Ø110mm e obligatoriu dacă WC-ul se racordează la ea.',
  },
  plumbing_drainage_secondary: {
    normativeCitation: 'I 9-2022 §13 + SR EN 12056-2',
    plainExplanation: 'Țevile Ø50mm leagă lavoarele, dușurile și chiuveta de coloana principală. Panta lor de minim 2% asigură că apa curge singură, fără pompe.',
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
  const explanation = PLAIN_EXPLANATIONS[formulaKey];
  const normativeReason = explanation
    ? `📐 ${explanation.normativeCitation} — ${explanation.plainExplanation}`
    : formula.note
      ? `📐 ${formula.note}`
      : '';

  // Îmbinăm nota tehnică internă cu explicația prietenoasă, despărțite de un separator clar
  const finalNote = normativeReason ? `${noteparts} ||EXPLAIN|| ${normativeReason}` : noteparts;

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
