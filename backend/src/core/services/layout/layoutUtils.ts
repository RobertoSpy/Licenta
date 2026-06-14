import { ConfiguratorDimensions, ConfiguratorRoom, LAYOUT_CONSTANTS } from './layoutTypes';

export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalizes Romanian characters and trims whitespace
 */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function isDayRoom(r: ConfiguratorRoom): boolean {
  const z = (r.zone || '').toLowerCase();
  if (z.includes('zi') || z.includes('distributie')) return true;
  if (z.includes('noapte') || z.includes('tehnic')) return false;
  // fallback
  const norm = normalizeLabel(r.label);
  return (
    norm.includes('living') ||
    norm.includes('sufragerie') ||
    norm.includes('bucatarie') ||
    norm.includes('hol') ||
    norm.includes('antreu') ||
    norm.includes('vestibul') ||
    norm.includes('debara') ||
    norm.includes('camara') ||
    norm.includes('dining')
  );
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
