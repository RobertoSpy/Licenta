// backend/src/services/contextMultiplierEngine.ts
//
// MODUL PUR DETERMINIST — zero side effects, zero apeluri externe.
// Calculează multiplicatorii contextuali injectați în formulele BOM.
//
// SURSĂ NORMATIVĂ pentru multiplicatorii seismici:
//   • P100-1/2013 Cap.8: cerințe ductilitate DCM/DCH per zonă seismică ag.
//     – DCM (ductilitate medie): 0.10g ≤ ag < 0.25g
//     – DCH (ductilitate înaltă): ag ≥ 0.25g
//   • NE012-1:2022 Cap.5, Tab.5.2: dozaje minime armătură (ρmin) per clasă DCM/DCH.
//     – DCH impune ρmin cu 30–60% mai mare față de DCM.
//   • GT 063-2013 „Ghid privind detalierea armăturilor în structuri de beton armat":
//     procente armătură recomandate per nivel seismic.
//   • Practică inginerească: devize reale din zone cu ag 0.10g vs 0.35g confirmă
//     surplus de 15–60% la cantitățile de armătură și ancoraje.
//
// IMPORTANT: Multiplicatorii sunt ESTIMĂRI ORIENTATIVE pentru devizare.
//   Armătura exactă se determină prin calcul structural detaliat (RDS/ETABS/SAFE).
//   Sursa: P100-1/2013 Art. 4.4.2 + NE012-1:2022 Tab. 5.2 + practică devizare.
//
// SURSĂ NORMATIVĂ pentru multiplicatorii de sol:
//   • NP112-2014 Cap.4: presiunea convențională de calcul pconv per tip sol.
//     – Argilă/loess pconvenienta < 150 kPa → fundație mai lată (mai mult beton).
//     – Stâncă/pietriș pconv > 300 kPa → fundație mai îngustă (mai puțin beton).
//   • NP112-2014 Tab.4.1: lățimi recomandate talpă fundație per tip sol și număr etaje.

// ─────────────────────────────────────────────────────────────────
// TIPURI
// ─────────────────────────────────────────────────────────────────

export interface ProjectContextInput {
  seismicZone?: string | null;     // ex: '0.35g' — din Faza 1, P100-1/2013 Anexa A
  soilType?: string | null;        // ex: 'Argilos', 'Nisipos', 'Stâncos', 'Pietros'
  frostDepthCm?: number | null;    // ex: 100 — din Faza 1, NP112-2014 Anexa B
  totalFloors?: number | null;     // ex: 2 — numărul de niveluri supraterane
  hasBasement?: boolean;           // dacă proiectul are subsol
  houseStyle?: string | null;      // ex: 'Modern', 'Industrial'
  energyClass?: string | null;     // ex: 'A'
}

/** Materialul betonului selectat determinist din ag + frost. Tipuri sigure, nu string liber. */
export type ConcreteMaterialCode = 'STANDARD_BETON_C20_25' | 'STANDARD_BETON_C25_30';
export type ConcreteClass = 'C20/25-XC2' | 'C25/30-XF2';

export interface ContextMultipliers {
  // ── Multiplicator armătură seismică ────────────────────────────
  seismic_multiplier: number;

  // ── Multiplicator beton fundație ───────────────────────────────
  soil_concrete_multiplier: number;

  // ── Lățimea tălpii fundației ────────────────────────────────────
  foundation_width_m: number;

  // ── Cantitate armătură de referință ────────────────────────────
  base_rebar_kg_per_mc: number;

  // ── Adâncimea fundației ─────────────────────────────────────────
  frost_depth_m: number;

  // ── Clasa de beton selectată determinist ───────────────────────
  concreteCode: ConcreteMaterialCode | 'STANDARD_BETON_C30_37';
  concreteClass: ConcreteClass | 'C30/37-XF4';

  // ── Selecții Inteligente Materiale (AI defaults) ───────────────
  // ELIMINAT: exteriorWallCode, interiorWallCode, insulationExteriorCode,
  // insulationRoofCode, windowsCode — mutate în bom-formulas.json ca
  // defaultMaterialCode + upgrades (data-driven, fără hardcode în TS).
  // Singurul cod rămas este rebarCode, folosit de STRICT_NORMATIVE (engineKey='rebarCode').
  rebarCode: string;

  // ── Stâlpișori zidărie confinată ───────────────────────────────
  count_corners_and_intersections: number;

  // ── Note pentru transparență (incluse în câmpul note al BOM) ───
  seismic_note: string;
  soil_note: string;
  concrete_note: string;

  // ── Coeficient subsol (Indicii cost în construcții, Cap. 3) ───────────────
  // Subsolul în devizare se echivalează la 50% din costul unui nivel suprateran,
  // datorită absenței finisajelor locuibile și prezenței hidroizolației și
  // lucrărilor de săpătură care compensează diferit față de suprastructură.
  // Sursa: Indicii cost în construcții (INSSE) — Coeficient de echivalare nivel subteran = 0.50
  basement_sqm_coefficient: number;  // 0.50 dacă are subsol, 0 dacă nu
  basement_note: string;
}

// ─────────────────────────────────────────────────────────────────
// TABEL SEISMIC — derivat din P100-1/2013 Cap.8 + NE012-1:2022 Tab.5.2
// ─────────────────────────────────────────────────────────────────

interface SeismicRule {
  agMin: number;
  ductilityClass: 'DCL' | 'DCM' | 'DCH';
  multiplier: number;
  _normSource: string;
}

const SEISMIC_RULES: SeismicRule[] = [
  {
    agMin: 0.35,
    ductilityClass: 'DCH',
    multiplier: 1.60,
    _normSource: 'P100-1/2013 Cap.8, ag≥0.35g → DCH; NE012-1:2022 Tab.5.2 ρmin(DCH) +60% față de static',
  },
  {
    agMin: 0.30,
    ductilityClass: 'DCH',
    multiplier: 1.45,
    _normSource: 'P100-1/2013 Cap.8, ag=0.30g → DCH; NE012-1:2022 Tab.5.2 ρmin(DCH) +45% față de static',
  },
  {
    agMin: 0.25,
    ductilityClass: 'DCH',
    multiplier: 1.30,
    _normSource: 'P100-1/2013 Cap.8, ag=0.25g → DCH limită; NE012-1:2022 Tab.5.2 ρmin(DCH) +30%',
  },
  {
    agMin: 0.20,
    ductilityClass: 'DCM',
    multiplier: 1.15,
    _normSource: 'P100-1/2013 Cap.8, ag=0.20g → DCM; NE012-1:2022 Tab.5.2 ρmin(DCM) +15%',
  },
  {
    agMin: 0.10,
    ductilityClass: 'DCM',
    multiplier: 1.05,
    _normSource: 'P100-1/2013 Cap.8, ag=0.10g → DCM; NE012-1:2022 Tab.5.2 ρmin(DCM) +5% față de static',
  },
  {
    agMin: 0,
    ductilityClass: 'DCL',
    multiplier: 1.00,
    _normSource: 'P100-1/2013 Cap.8, ag<0.10g → DCL; armătură structurală conform NE012-1:2022 minim absolut',
  },
];

// ─────────────────────────────────────────────────────────────────
// TABEL SOL — NP112-2014 Tab.4.1 (presiunea convențională de calcul)
// ─────────────────────────────────────────────────────────────────

interface SoilRule {
  pattern: RegExp;
  concreteMult: number;
  _normSource: string;
  label: string;
}

const SOIL_RULES: SoilRule[] = [
  {
    pattern: /argi|lut|loess|loes|plastic|curgator|curgător/i,
    concreteMult: 1.35,
    label: 'Argilă/Loess',
    _normSource: 'NP112-2014 Tab.4.1: pconv<150kPa → talpă mai lată cu ~35%; risc tasare neuniformă',
  },
  {
    pattern: /praf|mlastin|mlaștinos|turb|umpl|umplut|compresibil/i,
    concreteMult: 1.25,
    label: 'Praf/Turbă',
    _normSource: 'NP112-2014 Tab.4.1: pconv<200kPa → talpă mai lată cu ~25%; sol compresibil',
  },
  {
    pattern: /nisip|nisipos/i,
    concreteMult: 1.10,
    label: 'Nisip',
    _normSource: 'NP112-2014 Tab.4.1: pconv~200kPa → talpă cu ~10% mai lată față de sol mediu',
  },
  {
    pattern: /pietri|bolovan|balast|granular/i,
    concreteMult: 1.00,
    label: 'Pietriș/Balast',
    _normSource: 'NP112-2014 Tab.4.1: pconv>300kPa → fundație standard; capacitate portantă bună',
  },
  {
    pattern: /stanc|stânc|roc|granit|calcar|bazalt/i,
    concreteMult: 0.90,
    label: 'Stâncă/Rocă',
    _normSource: 'NP112-2014 Tab.4.1: pconv>600kPa → talpă mai îngustă posibilă; fundație pe rocă',
  },
];

// ─────────────────────────────────────────────────────────────────
// FUNCȚII HELPER
// ─────────────────────────────────────────────────────────────────

function parseAg(seismicZone?: string | null): number {
  if (!seismicZone) return 0;
  const match = seismicZone.match(/(\d+\.?\d*)\s*g/i);
  return match ? parseFloat(match[1]) : 0;
}

function getSeismicRule(ag: number): SeismicRule {
  for (const rule of SEISMIC_RULES) {
    if (ag >= rule.agMin) return rule;
  }
  return SEISMIC_RULES[SEISMIC_RULES.length - 1]; 
}

function getSoilRule(soilType?: string | null): SoilRule {
  if (soilType) {
    for (const rule of SOIL_RULES) {
      if (rule.pattern.test(soilType)) return rule;
    }
  }
  return {
    pattern: /.*/,
    concreteMult: 1.05,
    label: 'Sol mediu (necunoscut)',
    _normSource: 'NP112-2014: sol necunoscut → +5% față de standard (marjă de siguranță)',
  };
}

function calcFoundationWidth(floors: number, soilMult: number): number {
  const baseWidthM = 0.50 + (floors - 1) * 0.10; 
  const raw = baseWidthM * soilMult;
  return Math.round(raw * 20) / 20;
}

function calcConcreteClass(ag: number, frostDepthCm: number, soilType?: string | null): { code: string; class: string; note: string } {
  const isWeakSoil = soilType && /argi|nisip|lut/i.test(soilType);
  if (ag >= 0.30 && isWeakSoil) {
     return {
      code: 'STANDARD_BETON_C30_37',
      class: 'C30/37-XF4',
      note: `C30/37 aplicat automat: zonă seismică severă (${ag}g) + sol slab (${soilType})`,
     };
  }

  const needsUpgrade = ag >= 0.25 || frostDepthCm > 90;
  if (needsUpgrade) {
    const reasons: string[] = [];
    if (ag >= 0.25) reasons.push(`ag=${ag}g \u2265 0.25g`);
    if (frostDepthCm > 90) reasons.push(`\u00eenghe\u021b ${frostDepthCm}cm > 90cm (XF2)`);
    return {
      code: 'STANDARD_BETON_C25_30',
      class: 'C25/30-XF2',
      note: `C25/30-XF2 aplicat automat: ${reasons.join(' + ')} \u2014 NE012-1:2022 Tab.E.1`,
    };
  }
  return {
    code: 'STANDARD_BETON_C20_25',
    class: 'C20/25-XC2',
    note: `C20/25-XC2: ag=${ag}g <0.25g \u0219i \u00eenghe\u021b ${frostDepthCm}cm \u226490cm \u2014 NE012-1:2022 Tab.E.1`,
  };
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// FUNC\u021aIA PRINCIPAL\u0102 \u2014 EXPORT
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export function buildContextMultipliers(
  input: ProjectContextInput,
  planMetrics?: {
    interiorWallsM?: number;
    countWindows?: number;
    countExteriorDoors?: number;
  }
): ContextMultipliers {
  const ag = parseAg(input.seismicZone);
  const frostDepthCm = input.frostDepthCm ?? 80;
  const floors = Math.max(1, input.totalFloors ?? 1);

  const seismicRule = getSeismicRule(ag);
  const soilRule = getSoilRule(input.soilType);
  const foundationWidthM = calcFoundationWidth(floors, soilRule.concreteMult);
  const concreteInfo = calcConcreteClass(ag, frostDepthCm, input.soilType);

  let frostDepthM = Math.max((frostDepthCm + 10) / 100, 0.80);
  if (input.hasBasement) {
    frostDepthM = 2.80; // ad\u00e2ncime tipic\u0103 subsol reziden\u021bial
  }

  const interiorWallsM = planMetrics?.interiorWallsM ?? 20 * floors;
  const countWindows = planMetrics?.countWindows ?? 6 * floors;
  const countExtDoors = planMetrics?.countExteriorDoors ?? 1;

  const count_corners_and_intersections = Math.round(
    4
    + Math.floor(interiorWallsM / 4.5)
    + countWindows
    + countExtDoors
  );

  // \u2500\u2500\u2500 rebarCode: STRICT_NORMATIVE (P100-1/2013 + NE012-1:2022) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // P\u0103strat \u00een contextMultiplierEngine pentru c\u0103 e determinist normativ (nu selec\u021bie liber\u0103).
  // Toate celelalte materiale (zid\u0103rie, ferestre, izola\u021bie) au fost mutate
  // \u00een bom-formulas.json ca defaultMaterialCode + upgrades (data-driven).
  let rebarCode = 'STANDARD_FIER_12';
  if (ag >= 0.30) {
    rebarCode = 'STANDARD_FIER_14'; // DCH \u2014 ductilitate \u00eenalt\u0103
  }

  const seismic_note =
    ag > 0
      ? `seismic_mult=${seismicRule.multiplier} (ag=${ag}g, ${seismicRule.ductilityClass} — ${seismicRule._normSource})`
      : 'seismic_mult=1.0 (ag nedeterminat — fără majorare)';

  const soil_note =
    `sol_mult=${soilRule.concreteMult} (${soilRule.label} — ${soilRule._normSource})`;

  if (input.hasBasement) {
    concreteInfo.note += ' [SĂPĂTURĂ/FUNDAȚIE ADÂNCĂ pt. SUBSOL (2.8m)]';
  }

  const basement_sqm_coefficient = input.hasBasement ? 0.50 : 0;
  const basement_note = input.hasBasement
    ? 'Subsol echivalat la 0.50 din costul unui nivel suprateran — Indicii cost în construcții (INSSE), Cap. 3: Coeficient nivel subteran = 0.50 (absență finisaje locuibile + hidroizolație + săpătură)'
    : 'Fără subsol — coeficient echivalare = 0';

  return {
    seismic_multiplier:              seismicRule.multiplier,
    soil_concrete_multiplier:        soilRule.concreteMult,
    foundation_width_m:              foundationWidthM,
    base_rebar_kg_per_mc:            15,
    frost_depth_m:                   frostDepthM,
    concreteCode:                    concreteInfo.code as any,
    concreteClass:                   concreteInfo.class as any,
    count_corners_and_intersections,
    rebarCode,
    seismic_note,
    soil_note,
    concrete_note: concreteInfo.note,
    basement_sqm_coefficient,
    basement_note,
  };
}
