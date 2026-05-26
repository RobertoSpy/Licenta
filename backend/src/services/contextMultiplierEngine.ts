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
}

/** Materialul betonului selectat determinist din ag + frost. Tipuri sigure, nu string liber. */
export type ConcreteMaterialCode = 'STANDARD_BETON_C20_25' | 'STANDARD_BETON_C25_30';
export type ConcreteClass = 'C20/25-XC2' | 'C25/30-XF2';

export interface ContextMultipliers {
  // ── Multiplicator armătură seismică ────────────────────────────
  /** Factor aplicat pe cantitățile de fier din fundație și stâlpișori.
   *  Derivat din clasa de ductilitate DCM/DCH (P100-1/2013 Cap.8). */
  seismic_multiplier: number;

  // ── Multiplicator beton fundație ───────────────────────────────
  /** Factor aplicat pe volumul de beton al fundației.
   *  Sol slab (argilă/loess) → talpă mai lată → mai mult beton (NP112-2014 Tab.4.1). */
  soil_concrete_multiplier: number;

  // ── Lățimea tălpii fundației ────────────────────────────────────
  /** Lățimea calculată a tălpii continue de fundație, în metri.
   *  Baza: 0.50m per 1 etaj + corecție sol (NP112-2014 Cap.4). */
  foundation_width_m: number;

  // ── Cantitate armătură de referință ────────────────────────────
  /** kg armătură la 1 mc beton fundație, înainte de multiplicatorul seismic.
   *  Valoare de bază: 15 kg/mc (Conform NE012-1:2022 dozaj minim fundații). */
  base_rebar_kg_per_mc: number;

  // ── Adâncimea fundației ─────────────────────────────────────────
  /** Adâncimea de fundare în metri (10cm sub limita de îngheț, min 0.80m).
   *  Conform NP112-2014 Art.5.3. */
  frost_depth_m: number;

  // ── Clasa de beton selectată determinist ───────────────────────
  /** Codul materialului din catalog DB — niciodată string liber. */
  concreteCode: ConcreteMaterialCode;
  /** Clasa tehnică de beton conform NE012-1:2022 Tab.E.1. */
  concreteClass: ConcreteClass;

  // ── Stâlpișori zidărie confinată ───────────────────────────────
  /** Numărul estimat de stâlpișori de beton (ZC per CR6-2013 Art.7.4).
   *  Formula: colțuri_ext + intersecții(~4.5m) + goluri_mari (uși + ferestre ext.). */
  count_corners_and_intersections: number;

  // ── Note pentru transparență (incluse în câmpul note al BOM) ───
  seismic_note: string;
  soil_note: string;
  concrete_note: string;
}

// ─────────────────────────────────────────────────────────────────
// TABEL SEISMIC — derivat din P100-1/2013 Cap.8 + NE012-1:2022 Tab.5.2
// ─────────────────────────────────────────────────────────────────

interface SeismicRule {
  /** Prag minim ag pentru această regulă. */
  agMin: number;
  /** Clasa de ductilitate conform P100-1/2013. */
  ductilityClass: 'DCL' | 'DCM' | 'DCH';
  /** Multiplicator estimat pentru cantitățile de armătură.
   *  Sursa: NE012-1:2022 Tab.5.2 ρmin per clasă + devize reale. */
  multiplier: number;
  /** Sursă normativă exactă pentru transparență în BOM. */
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
  /** Regex aplicat pe soilType (case-insensitive). */
  pattern: RegExp;
  /** Factor lățime talpă fundație (1.0 = 50cm bază, 1.3 = 65cm etc.). */
  concreteMult: number;
  /** Sursă normativă. */
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

/** Parsează '0.35g' → 0.35. Returnează 0 dacă input invalid. */
function parseAg(seismicZone?: string | null): number {
  if (!seismicZone) return 0;
  const match = seismicZone.match(/(\d+\.?\d*)\s*g/i);
  return match ? parseFloat(match[1]) : 0;
}

function getSeismicRule(ag: number): SeismicRule {
  // Sortate descrescător — primul care trece de prag câștigă
  for (const rule of SEISMIC_RULES) {
    if (ag >= rule.agMin) return rule;
  }
  return SEISMIC_RULES[SEISMIC_RULES.length - 1]; // DCL fallback
}

function getSoilRule(soilType?: string | null): SoilRule {
  if (soilType) {
    for (const rule of SOIL_RULES) {
      if (rule.pattern.test(soilType)) return rule;
    }
  }
  // Default: sol mediu (nisip compact) — cel mai frecvent în România periurban
  return {
    pattern: /.*/,
    concreteMult: 1.05,
    label: 'Sol mediu (necunoscut)',
    _normSource: 'NP112-2014: sol necunoscut → +5% față de standard (marjă de siguranță)',
  };
}

/** Lățimea fundației în metri: baza 0.50m + 0.10m per etaj + corecție sol.
 *  Conform NP112-2014 Cap.4 + practică inginerească. */
function calcFoundationWidth(floors: number, soilMult: number): number {
  const baseWidthM = 0.50 + (floors - 1) * 0.10; // 0.50m parter, +10cm per etaj
  const raw = baseWidthM * soilMult;
  // Rotunjim la 5cm (precizia cofrelor standard)
  return Math.round(raw * 20) / 20;
}

/** Clasa betonului: ag ≥ 0.30g SAU adâncime îngheț > 90cm → C25/30-XF2.
 *  NE012-1:2022 Tab.E.1 + NP112-2014 Art.5.3. */
function calcConcreteClass(ag: number, frostDepthCm: number): { code: ConcreteMaterialCode; class: ConcreteClass; note: string } {
  const needsUpgrade = ag >= 0.30 || frostDepthCm > 90;
  if (needsUpgrade) {
    const reasons: string[] = [];
    if (ag >= 0.30) reasons.push(`ag=${ag}g ≥ 0.30g (zonă DCH)`);
    if (frostDepthCm > 90) reasons.push(`îngheț ${frostDepthCm}cm > 90cm (XF2)`);
    return {
      code: 'STANDARD_BETON_C25_30',
      class: 'C25/30-XF2',
      note: `C25/30-XF2 aplicat automat: ${reasons.join(' + ')} — NE012-1:2022 Tab.E.1`,
    };
  }
  return {
    code: 'STANDARD_BETON_C20_25',
    class: 'C20/25-XC2',
    note: `C20/25-XC2: ag=${ag}g <0.30g și îngheț ${frostDepthCm}cm ≤90cm — NE012-1:2022 Tab.E.1 (expunere XC2)`,
  };
}

// ─────────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ — EXPORT
// ─────────────────────────────────────────────────────────────────

/**
 * Calculează toți multiplicatorii contextuali pentru un proiect dat.
 *
 * @param input - Date din Faza 1 a proiectului (seismicZone, soilType, frostDepthCm, totalFloors)
 * @param planMetrics - (opțional) metrici extrase din PlanSnapshot pentru calcul stâlpișori exact
 *
 * Returnează un obiect imutabil cu toți coeficienții + notele normative asociate.
 * Nu are efecte secundare, nu face apeluri la DB sau externe.
 */
export function buildContextMultipliers(
  input: ProjectContextInput,
  planMetrics?: {
    interiorWallsM?: number;
    countWindows?: number;
    countExteriorDoors?: number;
  }
): ContextMultipliers {
  const ag = parseAg(input.seismicZone);
  const frostDepthCm = input.frostDepthCm ?? 80; // default 80cm (zona temperată fără date)
  const floors = Math.max(1, input.totalFloors ?? 1);

  // 1. Reguli seismice
  const seismicRule = getSeismicRule(ag);

  // 2. Reguli sol
  const soilRule = getSoilRule(input.soilType);

  // 3. Lățimea fundației (combină etaje + sol)
  const foundationWidthM = calcFoundationWidth(floors, soilRule.concreteMult);

  // 4. Clasa betonului
  const concreteInfo = calcConcreteClass(ag, frostDepthCm);

  // 5. Adâncimea fundației: 10cm sub limita de îngheț, min 80cm (NP112-2014 Art.5.3)
  const frostDepthM = Math.max((frostDepthCm + 10) / 100, 0.80);

  // 6. Stâlpișori de zidărie confinată (CR6-2013 Art.7.4)
  //    – 4 colțuri exterioare (casă dreptunghiulară de bază)
  //    – 1 stâlpișor la fiecare ~4.5m de perete interior structurat (max dist. CR6)
  //    – 1 stâlpișor per gol mare (fereastră + ușă exterior > 1.2m lățime) — reglementat CR6-2013 Art.7.4.3
  const interiorWallsM = planMetrics?.interiorWallsM ?? 20 * floors; // fallback estimare
  const countWindows = planMetrics?.countWindows ?? 6 * floors;
  const countExtDoors = planMetrics?.countExteriorDoors ?? 1;

  const count_corners_and_intersections = Math.round(
    4                                          // colțuri exterioare fixe (formă dreptunghiulară)
    + Math.floor(interiorWallsM / 4.5)         // intersecții pereți interiori la max 4.5m (CR6-2013 Art.7.4.2)
    + countWindows                             // stâlpișori la goluri ferestre (>1.2m lățime tipic)
    + countExtDoors                            // stâlpișori la uși exterioare
  );

  // 7. Notele finale pentru câmpul 'note' din BOM
  const seismic_note =
    ag > 0
      ? `seismic_mult=${seismicRule.multiplier} (ag=${ag}g, ${seismicRule.ductilityClass} — ${seismicRule._normSource})`
      : 'seismic_mult=1.0 (ag nedeterminat — fără majorare)';

  const soil_note =
    `sol_mult=${soilRule.concreteMult} (${soilRule.label} — ${soilRule._normSource})`;

  return {
    seismic_multiplier:       seismicRule.multiplier,
    soil_concrete_multiplier: soilRule.concreteMult,
    foundation_width_m:       foundationWidthM,
    base_rebar_kg_per_mc:     15, // kg/mc — NE012-1:2022 dozaj minim, înmulțit de seismic_multiplier în formulă
    frost_depth_m:            frostDepthM,
    concreteCode:             concreteInfo.code,
    concreteClass:            concreteInfo.class,
    count_corners_and_intersections,
    seismic_note,
    soil_note,
    concrete_note: concreteInfo.note,
  };
}
