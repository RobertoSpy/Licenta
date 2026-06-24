import fs from 'fs';
import path from 'path';

const NORMATIVE_MAPPING = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../data/normative-material-mapping.json'), 'utf8')
);

const STRUCTURAL_RULES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../data/structural-rules.json'), 'utf8')
);

export interface ProjectContextInput {
  seismicZone?: string | null;
  soilType?: string | null;
  frostDepthCm?: number | null;
  totalFloors?: number | null;
  hasBasement?: boolean;
  houseStyle?: string | null;
  energyClass?: string | null;
}

export type ConcreteMaterialCode = 'STANDARD_BETON_C20_25' | 'STANDARD_BETON_C25_30';
export type ConcreteClass = 'C20/25-XC2' | 'C25/30-XF2' | 'C30/37-XF4';

export interface ContextMultipliers {
  seismic_multiplier: number;
  soil_concrete_multiplier: number;
  foundation_width_m: number;
  base_rebar_kg_per_mc: number;
  frost_depth_m: number;
  concreteCode: string;
  concreteClass: ConcreteClass;
  rebarCode: string;
  count_corners_and_intersections: number;
  basement_sqm_coefficient: number;
}

interface SeismicRule {
  agMin: number;
  ductilityClass: string;
  multiplier: number;
}

interface SoilRule {
  patternStr: string;
  concreteMult: number;
}

function parseAg(seismicZone?: string | null): number {
  if (!seismicZone) return 0;
  const match = seismicZone.match(/(\d+\.?\d*)\s*(?:g)?/i);
  return match ? parseFloat(match[1]) : 0;
}

function getSeismicRule(ag: number): SeismicRule {
  const rules = STRUCTURAL_RULES.seismicRules as SeismicRule[];
  for (const rule of rules) {
    if (ag >= rule.agMin) return rule;
  }
  return rules[rules.length - 1];
}

function getSoilRule(soilType?: string | null): number {
  if (soilType) {
    const rules = STRUCTURAL_RULES.soilRules as SoilRule[];
    for (const rule of rules) {
      if (new RegExp(rule.patternStr, 'i').test(soilType)) {
        return rule.concreteMult;
      }
    }
  }
  return STRUCTURAL_RULES.constants.defaultSoilConcreteMult;
}

function calcFoundationWidth(floors: number, soilMult: number): number {
  const baseWidthM = 0.50 + (floors - 1) * 0.10;
  const raw = baseWidthM * soilMult;
  return Math.round(raw * 20) / 20;
}

function calcConcreteClass(ag: number, frostDepthCm: number, soilType?: string | null): { mappingKey: string; class: ConcreteClass } {
  const isWeakSoil = soilType && /argi|nisip|lut/i.test(soilType);
  if (ag >= 0.30 && isWeakSoil) {
    return { mappingKey: 'C30_37', class: 'C30/37-XF4' };
  }

  if (ag >= 0.25 || frostDepthCm > 90) {
    return { mappingKey: 'C25_30', class: 'C25/30-XF2' };
  }
  
  return { mappingKey: 'C20_25', class: 'C20/25-XC2' };
}

export function buildContextMultipliers(
  input: ProjectContextInput,
  planMetrics?: {
    interiorWallsM?: number;
    countWindows?: number;
    countExteriorDoors?: number;
    countCorners?: number;
  }
): ContextMultipliers {
  const ag = parseAg(input.seismicZone);
  const frostDepthCm = input.frostDepthCm ?? 80;
  const floors = Math.max(1, input.totalFloors ?? 1);

  const seismicRule = getSeismicRule(ag);
  const soilMult = getSoilRule(input.soilType);
  const foundationWidthM = calcFoundationWidth(floors, soilMult);
  const concreteInfo = calcConcreteClass(ag, frostDepthCm, input.soilType);

  let frostDepthM = Math.max((frostDepthCm + 10) / 100, 0.80);
  if (input.hasBasement) {
    frostDepthM = STRUCTURAL_RULES.constants.basementDepthM;
  }

  if (!planMetrics) {
    throw new Error('PlanMetrics este obligatoriu. Nu se poate genera devizul fără un plan 2D valid salvat.');
  }

  const count_corners_and_intersections = Math.round(planMetrics.countCorners ?? 0);

  let rebarCode = NORMATIVE_MAPPING.rebar.standard;
  if (ag >= 0.30) {
    rebarCode = NORMATIVE_MAPPING.rebar.high_seismic;
  }

  const basement_sqm_coefficient = input.hasBasement ? STRUCTURAL_RULES.constants.basementSqmCoefficient : 0;

  return {
    seismic_multiplier: seismicRule.multiplier,
    soil_concrete_multiplier: soilMult,
    foundation_width_m: foundationWidthM,
    base_rebar_kg_per_mc: 65,
    frost_depth_m: frostDepthM,
    concreteCode: NORMATIVE_MAPPING.concrete[concreteInfo.mappingKey] as string,
    concreteClass: concreteInfo.class,
    count_corners_and_intersections,
    rebarCode,
    basement_sqm_coefficient,
  };
}
