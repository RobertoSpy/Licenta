// frontend/src/utils/layoutPartitioner.ts
// Frontend helper shared by the editor UI only.
// The real layout generator lives in backend/src/core/services/layout/layoutPartitioner.ts.
//
// IMPORTANT: calculateShapeArea here is used ONLY for local UI display (showing approximate
// area in the left panel). Layout generation always goes through the backend API.
// If the backend formula changes, update this function too to keep UI estimates consistent.

export interface ConfiguratorRoom {
  id: string;
  label: string;
  ratioValue: number; // 1 = Mic, 2 = Mediu, 3 = Mare
  minSqm?: number;
  maxSqm?: number;
  mustAdjacentTo?: string[];
  hasDoorTo?: string[];
  isCirculation?: boolean;
  hasStaircase?: boolean;
  naturalLight?: boolean;
  orientation?: string[];
  zone?: string;
}

export interface ConfiguratorDimensions {
  widthM: number;
  heightM: number;
  wingWidthM?: number;
  wingLengthM?: number;
}

/** Calculates the usable area for a given shape and bounding box.
 *  Mirrors backend layoutUtils.calculateShapeArea — keep in sync if formulas change. */
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

// No layout generation in frontend. The editor requests it from the backend API.
