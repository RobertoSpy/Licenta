import { ConfiguratorDimensions, ConfiguratorRoom, LAYOUT_CONSTANTS } from './layoutTypes';
import { normalizeLabel } from '../conformityLookup';
import conformityRules from '../../../data/conformity-rules.json';

export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export { normalizeLabel };

const corridorRule = (conformityRules as any).clearance_rules.find(
  (r: any) => r.code === 'L114_CORRIDOR_WIDTH'
);
const CIRCULATION_TYPES = new Set(
  (corridorRule?.targets ?? ['hol', 'coridor', 'vestibul']).map((t: string) => normalizeLabel(t))
);

export function isCirculationRoom(room: { type?: string; label?: string; isCirculation?: boolean }): boolean {
  if (room.isCirculation === true) return true;
  const typeKey = room.type ? normalizeLabel(room.type) : '';
  const labelKey = room.label ? normalizeLabel(room.label) : '';
  return CIRCULATION_TYPES.has(typeKey) || CIRCULATION_TYPES.has(labelKey);
}


export function calculateShapeArea(shape: string, dims: ConfiguratorDimensions): number {
  const w = dims.widthM;
  const h = dims.heightM;
  const ww = dims.wingWidthM ?? 4;
  const wl = dims.wingLengthM ?? 4;

  if (shape === 'rectangle') {
    return w * h;
  } else if (shape === 'l_shape') {
    const w1 = Math.min(ww, w - 2);
    const h2 = Math.min(wl, h - 2);
    return w1 * h + (w - w1) * h2;
  } else if (shape === 'u_shape') {
    const w1 = Math.min(ww, w / 2.5);
    const h2 = Math.min(wl, h - 2);
    return 2 * w1 * h + (w - 2 * w1) * h2;
  } else if (shape === 't_shape') {
    const h1 = Math.min(wl, h / 2.2);
    const w2 = Math.min(ww, w - 2);
    return w * h1 + w2 * (h - h1);
  }
  return w * h;
}

export function calcHouseFootprint(
  totalSqm: number,
  shape: string = 'rectangle'
): { widthM: number; heightM: number } {
  const multipliers = LAYOUT_CONSTANTS.shape_multipliers as Record<string, number>;
  const mult = multipliers[shape] ?? 1.0;
  
  const widthM = Math.sqrt(totalSqm * (4/3) * mult);
  const heightM = (totalSqm * mult) / widthM;
  
  return { 
    widthM: parseFloat(widthM.toFixed(2)), 
    heightM: parseFloat(heightM.toFixed(2)) 
  };
}
