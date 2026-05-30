// frontend/src/utils/layoutPartitioner.ts
import { type CanvasElement } from '../hooks/useEditorState';
import { v4 as uuidv4 } from 'uuid';

const PIXELS_PER_METER = 20;

export const ARCHITECTURAL_STANDARDS = {
  DOOR: {
    RESIDENTIAL_INTERIOR: 0.8, // metri (Standard Legea 114)
    RESIDENTIAL_EXTERIOR: 0.9, // metri (Ușă intrare standard)
    COMMERCIAL_MINIMUM: 0.9,   // metri (Standard evacuare P118-99)
    BATHROOM: 0.7,             // metri (Standard uzual)
  },
  WINDOW: {
    STANDARD_WIDTH: 1.2,       // metri
  },
  WALL: {
    EXTERIOR_THICKNESS: 0.25,  // metri
    INTERIOR_THICKNESS: 0.125, // metri
  }
};

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

// Bounding box interface in meters
interface BBoxM {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Normalizes Romanian characters and trims whitespace
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isDayRoom(r: ConfiguratorRoom): boolean {
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

// --- Squarified Treemap Algorithm ---

interface WeightedItem { id: string; weight: number; original: any }
interface PlacedItem { id: string; bbox: BBoxM; original: any }

function getWorstRatio(row: number[], w: number): number {
  if (row.length === 0) return Infinity;
  const s = row.reduce((a, b) => a + b, 0);
  if (s === 0) return Infinity;
  const minArea = Math.min(...row);
  const maxArea = Math.max(...row);
  const w2 = w * w;
  const s2 = s * s;
  return Math.max((w2 * maxArea) / s2, s2 / (w2 * minArea));
}

function layoutRow(row: number[], x: number, y: number, w: number, h: number) {
  const sum = row.reduce((a, b) => a + b, 0);
  const rects: BBoxM[] = [];

  if (w >= h) {
    const rowWidth = sum / h;
    let currY = y;
    for (const area of row) {
      const rowHeight = area / rowWidth;
      rects.push({ x, y: currY, w: rowWidth, h: rowHeight });
      currY += rowHeight;
    }
    return { rects, nextX: x + rowWidth, nextY: y, nextW: w - rowWidth, nextH: h };
  } else {
    const rowHeight = sum / w;
    let currX = x;
    for (const area of row) {
      const rowWidth = area / rowHeight;
      rects.push({ x: currX, y, w: rowWidth, h: rowHeight });
      currX += rowWidth;
    }
    return { rects, nextX: x, nextY: y + rowHeight, nextW: w, nextH: h - rowHeight };
  }
}

function squarifyPartition(bbox: BBoxM, items: WeightedItem[], preserveOrder: boolean = false): PlacedItem[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ id: items[0].id, bbox, original: items[0].original }];

  const totalArea = bbox.w * bbox.h;
  const totalWeight = items.reduce((s, item) => s + item.weight, 0);

  if (totalWeight <= 0) {
    return items.map(i => ({ id: i.id, bbox: { ...bbox, w: bbox.w / items.length }, original: i.original }));
  }

  const sorted = preserveOrder ? [...items] : [...items].sort((a, b) => b.weight - a.weight);
  const areas = sorted.map(i => (i.weight / totalWeight) * totalArea);

  const resultBBoxes: BBoxM[] = [];
  let remaining = [...areas];
  let curRow: number[] = [];
  let cx = bbox.x, cy = bbox.y, cw = bbox.w, ch = bbox.h;

  while (remaining.length > 0) {
    const minSide = Math.min(cw, ch);
    if (minSide <= 0.01) {
       for (const _ of remaining) {
         resultBBoxes.push({ x: cx, y: cy, w: cw, h: ch });
       }
       break;
    }

    const nextArea = remaining[0];
    if (curRow.length === 0) {
      curRow.push(nextArea);
      remaining.shift();
      continue;
    }

    const worstWithNext = getWorstRatio([...curRow, nextArea], minSide);
    const worstWithoutNext = getWorstRatio(curRow, minSide);

    if (worstWithNext <= worstWithoutNext) {
      curRow.push(nextArea);
      remaining.shift();
    } else {
      const rowResult = layoutRow(curRow, cx, cy, cw, ch);
      resultBBoxes.push(...rowResult.rects);
      cx = rowResult.nextX;
      cy = rowResult.nextY;
      cw = rowResult.nextW;
      ch = rowResult.nextH;
      curRow = [];
    }
  }

  if (curRow.length > 0) {
    const rowResult = layoutRow(curRow, cx, cy, cw, ch);
    resultBBoxes.push(...rowResult.rects);
  }

  return resultBBoxes.map((box, i) => ({
    id: sorted[i].id,
    bbox: box,
    original: sorted[i].original
  }));
}

/**
 * FIX — Problema 3: Zone-based treemap uses area-correct weights.
 * Groups rooms by Zone, runs Treemap on Zones, then Treemap on Rooms inside each Zone.
 */
function zoneBasedTreemap(
  bbox: BBoxM,
  rooms: ConfiguratorRoom[],
  streetOrientation: string = 'S'
): Array<{ id: string; label: string; bbox: BBoxM }> {
  if (rooms.length === 0) return [];

  // FIX: compute area-based weight for each room
  const roomWeights = new Map<string, number>();
  const totalRatioWeight = rooms.reduce((s, r) => s + r.ratioValue, 0);
  for (const r of rooms) {
    let w: number;
    if (r.minSqm != null && r.maxSqm != null && r.minSqm > 0) {
      w = (r.minSqm + r.maxSqm) / 2;
    } else if (r.minSqm != null && r.minSqm > 0) {
      w = r.minSqm * 1.2;
    } else if (r.maxSqm != null && r.maxSqm > 0) {
      w = r.maxSqm * 0.8;
    } else {
      // No area data: proportion from ratioValue within available area
      w = (r.ratioValue / (totalRatioWeight || 1)) * bbox.w * bbox.h;
    }
    roomWeights.set(r.id, w);
  }

  const zonesMap = new Map<string, ConfiguratorRoom[]>();
  for (const r of rooms) {
    const z = r.zone?.toLowerCase() || 'zi';
    if (!zonesMap.has(z)) zonesMap.set(z, []);
    zonesMap.get(z)!.push(r);
  }

  // Zone weight = sum of room area weights in that zone
  const zoneItems: WeightedItem[] = [];
  for (const [zName, zRooms] of zonesMap.entries()) {
    const zWeight = zRooms.reduce((s, r) => s + (roomWeights.get(r.id) || r.ratioValue), 0);
    zoneItems.push({ id: zName, weight: zWeight, original: zRooms });
  }

  const street = streetOrientation.toUpperCase();
  zoneItems.sort((a, b) => {
    const rank = (z: string) => {
      // Dacă strada e Est ('E'), vrem ca 'distributie' / 'tehnic' să fie la dreapta (adică ultimele procesate de squarify)
      if (street.includes('E')) {
         if (z === 'zi') return 1;
         if (z === 'noapte') return 2;
         if (z === 'distributie' || z === 'tehnic') return 3;
      }
      // Dacă e Sud, vrem distributie jos (ultimele)
      if (street.includes('S')) {
         if (z === 'noapte') return 1;
         if (z === 'zi') return 2;
         if (z === 'distributie' || z === 'tehnic') return 3;
      }
      // Dacă e Nord, distributie sus (primele procesate de squarify)
      if (street.includes('N')) {
         if (z === 'distributie' || z === 'tehnic') return 1;
         if (z === 'zi') return 2;
         if (z === 'noapte') return 3;
      }
      // Vest: distributie stânga (primele)
      if (street.includes('V') || street.includes('W')) {
         if (z === 'distributie' || z === 'tehnic') return 1;
         if (z === 'zi') return 2;
         if (z === 'noapte') return 3;
      }
      return z === 'zi' ? 1 : z === 'noapte' ? 2 : 3;
    };
    return rank(a.id) - rank(b.id);
  });

  // Preserve our orientation-based sort order for zones
  const zonePlacements = squarifyPartition(bbox, zoneItems, true);

  const finalRooms: Array<{ id: string; label: string; bbox: BBoxM }> = [];

  for (const zp of zonePlacements) {
    const zRooms: ConfiguratorRoom[] = zp.original;
    // FIX: use area weights for room partition within zone
    const roomItems: WeightedItem[] = zRooms.map(r => ({
      id: r.id,
      weight: roomWeights.get(r.id) || r.ratioValue,
      original: r
    }));

    const roomPlacements = squarifyPartition(zp.bbox, roomItems);

    for (const rp of roomPlacements) {
      finalRooms.push({
        id: rp.id,
        label: rp.original.label,
        bbox: rp.bbox,
      });
    }
  }

  return finalRooms;
}

/**
 * Main function: partitions selected house shape footprint and returns list of canvas elements
 */
export function generateConfiguratorLayout(
  shape: 'rectangle' | 'l_shape' | 'u_shape' | 't_shape',
  dimensions: ConfiguratorDimensions,
  rooms: ConfiguratorRoom[],
  streetOrientation: string = 'S'
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const offsetM = 2; // Offset from canvas edge in meters

  // Default values
  const { widthM, heightM } = dimensions;
  const wingWidthM = dimensions.wingWidthM ?? 4;
  const wingLengthM = dimensions.wingLengthM ?? 4;

  const wThickM = ARCHITECTURAL_STANDARDS.WALL.EXTERIOR_THICKNESS; // outer wall
  const thickPx = Math.round(wThickM * PIXELS_PER_METER);

  // 1. Compute bounding boxes of the shape and list of outer walls
  const shapesBBoxes: BBoxM[] = [];
  const outerWallLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  if (shape === 'rectangle') {
    shapesBBoxes.push({
      x: offsetM,
      y: offsetM,
      w: widthM,
      h: heightM,
    });

    const xM = offsetM;
    const yM = offsetM;

    outerWallLines.push({ x1: xM, y1: yM, x2: xM + widthM, y2: yM }); // Top
    outerWallLines.push({ x1: xM, y1: yM + heightM, x2: xM + widthM, y2: yM + heightM }); // Bottom
    outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + heightM }); // Left
    outerWallLines.push({ x1: xM + widthM, y1: yM, x2: xM + widthM, y2: yM + heightM }); // Right
  } else if (shape === 'l_shape') {
    const w1 = Math.min(wingWidthM, widthM - 2);
    const h2 = Math.min(wingLengthM, heightM - 2);

    const leftWing = { x: offsetM, y: offsetM, w: w1, h: heightM };
    const rightWing = { x: offsetM + w1, y: offsetM + heightM - h2, w: widthM - w1, h: h2 };

    shapesBBoxes.push(leftWing, rightWing);

    const xM = offsetM;
    const yM = offsetM;

    outerWallLines.push({ x1: xM, y1: yM, x2: xM + w1, y2: yM });
    outerWallLines.push({ x1: xM + w1, y1: yM, x2: xM + w1, y2: yM + heightM - h2 });
    outerWallLines.push({ x1: xM + w1, y1: yM + heightM - h2, x2: xM + widthM, y2: yM + heightM - h2 });
    outerWallLines.push({ x1: xM + widthM, y1: yM + heightM - h2, x2: xM + widthM, y2: yM + heightM });
    outerWallLines.push({ x1: xM, y1: yM + heightM, x2: xM + widthM, y2: yM + heightM });
    outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + heightM });
  } else if (shape === 'u_shape') {
    const w1 = Math.min(wingWidthM, widthM / 2.5);
    const h2 = Math.min(wingLengthM, heightM - 2);

    const leftWing = { x: offsetM, y: offsetM, w: w1, h: heightM };
    const centerWing = { x: offsetM + w1, y: offsetM + heightM - h2, w: widthM - 2 * w1, h: h2 };
    const rightWing = { x: offsetM + widthM - w1, y: offsetM, w: w1, h: heightM };

    shapesBBoxes.push(leftWing, centerWing, rightWing);

    const xM = offsetM;
    const yM = offsetM;

    outerWallLines.push({ x1: xM, y1: yM, x2: xM + w1, y2: yM });
    outerWallLines.push({ x1: xM + w1, y1: yM, x2: xM + w1, y2: yM + heightM - h2 });
    outerWallLines.push({ x1: xM + w1, y1: yM + heightM - h2, x2: xM + widthM - w1, y2: yM + heightM - h2 });
    outerWallLines.push({ x1: xM + widthM - w1, y1: yM + heightM - h2, x2: xM + widthM - w1, y2: yM });
    outerWallLines.push({ x1: xM + widthM - w1, y1: yM, x2: xM + widthM, y2: yM });
    outerWallLines.push({ x1: xM + widthM, y1: yM, x2: xM + widthM, y2: yM + heightM });
    outerWallLines.push({ x1: xM, y1: yM + heightM, x2: xM + widthM, y2: yM + heightM });
    outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + heightM });
  } else {
    // t_shape
    const h1 = Math.min(wingLengthM, heightM / 2.2);
    const w2 = Math.min(wingWidthM, widthM - 2);
    const stemX = offsetM + (widthM - w2) / 2;

    const topWing = { x: offsetM, y: offsetM, w: widthM, h: h1 };
    const stemWing = { x: stemX, y: offsetM + h1, w: w2, h: heightM - h1 };

    shapesBBoxes.push(topWing, stemWing);

    const xM = offsetM;
    const yM = offsetM;

    outerWallLines.push({ x1: xM, y1: yM, x2: xM + widthM, y2: yM });
    outerWallLines.push({ x1: xM + widthM, y1: yM, x2: xM + widthM, y2: yM + h1 });
    outerWallLines.push({ x1: stemX + w2, y1: yM + h1, x2: xM + widthM, y2: yM + h1 });
    outerWallLines.push({ x1: stemX + w2, y1: yM + h1, x2: stemX + w2, y2: yM + heightM });
    outerWallLines.push({ x1: stemX, y1: yM + heightM, x2: stemX + w2, y2: yM + heightM });
    outerWallLines.push({ x1: stemX, y1: yM + h1, x2: stemX, y2: yM + heightM });
    outerWallLines.push({ x1: xM, y1: yM + h1, x2: stemX, y2: yM + h1 });
    outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + h1 });
  }

  // FIX — Problema 2: Separate terraces BEFORE zone processing so they are never
  // duplicated by zone splitting (one terrace per JSON entry, not one per zone).
  const indoorRooms = rooms.filter(r => !normalizeLabel(r.label).startsWith('terasa') && !r.label.toLowerCase().startsWith('teras'));
  const terraceRooms = rooms.filter(r => normalizeLabel(r.label).startsWith('terasa') || r.label.toLowerCase().startsWith('teras'));

  // 3. Distribute rooms to shape bounding boxes
  const partitionedRooms: Array<{ id: string; label: string; bbox: BBoxM }> = [];

  if (shapesBBoxes.length === 1) {
    // Rectangle
    partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], indoorRooms, streetOrientation));
  } else {
    // L, U, or T - multiple bounding boxes
    const dayRooms = indoorRooms.filter(r => isDayRoom(r));
    const nightRooms = indoorRooms.filter(r => !isDayRoom(r));

    if (shape === 'l_shape' || shape === 't_shape') {
      if (dayRooms.length > 0 && nightRooms.length > 0) {
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], dayRooms, streetOrientation));
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], nightRooms, streetOrientation));
      } else {
        const half = Math.ceil(indoorRooms.length / 2);
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], indoorRooms.slice(0, half), streetOrientation));
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], indoorRooms.slice(half), streetOrientation));
      }
    } else {
      // U-shape: 3 bounding boxes: 0 (left), 1 (center/bottom), 2 (right)
      if (dayRooms.length > 0) {
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], dayRooms, streetOrientation));

        const half = Math.ceil(nightRooms.length / 2);
        const leftRooms = nightRooms.slice(0, half);
        const rightRooms = nightRooms.slice(half);

        if (leftRooms.length > 0) partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], leftRooms, streetOrientation));
        if (rightRooms.length > 0) partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[2], rightRooms, streetOrientation));
      } else {
        const third = Math.ceil(indoorRooms.length / 3);
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], indoorRooms.slice(0, third), streetOrientation));
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], indoorRooms.slice(third, 2 * third), streetOrientation));
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[2], indoorRooms.slice(2 * third), streetOrientation));
      }
    }
  }

  // 3. Add Wall elements around the shape perimeter
  for (const line of outerWallLines) {
    const isHorizontal = Math.abs(line.y1 - line.y2) < 0.01;
    const x = Math.round(line.x1 * PIXELS_PER_METER);
    const y = Math.round(line.y1 * PIXELS_PER_METER);

    if (isHorizontal) {
      const width = Math.round(Math.abs(line.x2 - line.x1) * PIXELS_PER_METER);
      elements.push({
        id: uuidv4(),
        type: 'wall',
        x,
        y: y - thickPx / 2,
        width,
        height: thickPx,
        rotation: 0,
      });
    } else {
      const height = Math.round(Math.abs(line.y2 - line.y1) * PIXELS_PER_METER);
      elements.push({
        id: uuidv4(),
        type: 'wall',
        x: x - thickPx / 2,
        y,
        width: thickPx,
        height,
        rotation: 0,
      });
    }
  }

  // 4. Add Room elements
  for (const pr of partitionedRooms) {
    const rx = Math.round(pr.bbox.x * PIXELS_PER_METER);
    const ry = Math.round(pr.bbox.y * PIXELS_PER_METER);
    const rw = Math.round(pr.bbox.w * PIXELS_PER_METER);
    const rh = Math.round(pr.bbox.h * PIXELS_PER_METER);

    const isTerasa = pr.label.toLowerCase().startsWith('teras');

    elements.push({
      id: pr.id,
      type: isTerasa ? 'terasa' : 'room',
      label: pr.label,
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      rotation: 0,
      wallThicknessCm: ARCHITECTURAL_STANDARDS.WALL.EXTERIOR_THICKNESS * 100,
    });

    // 5. Generate automated Windows on exterior walls
    const roomDef = indoorRooms.find(ar => ar.id === pr.id);
    if (roomDef && roomDef.naturalLight) {
      const roomBBox = pr.bbox;
      const thresholdM = 0.05;
      const preferredOrientations = roomDef.orientation || [];

      let windowPlaced = false;

      // Primary pass: Try matching preferred orientations
      for (const line of outerWallLines) {
        const isHorizontal = Math.abs(line.y1 - line.y2) < 0.01;
        let wallOrientation = '';

        if (isHorizontal) {
          if (Math.abs(line.y1 - offsetM) < thresholdM) wallOrientation = 'N'; // Top
          else wallOrientation = 'S'; // Bottom

          const touchesWall = Math.abs(line.y1 - roomBBox.y) < thresholdM || Math.abs(line.y1 - (roomBBox.y + roomBBox.h)) < thresholdM;
          if (touchesWall && roomBBox.x + roomBBox.w > line.x1 + thresholdM && roomBBox.x < line.x2 - thresholdM) {
            if (preferredOrientations.length === 0 || preferredOrientations.some(o => wallOrientation.includes(o))) {
              const winW = Math.round(ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH * PIXELS_PER_METER);
              elements.push({
                id: uuidv4(),
                type: 'window',
                x: rx + rw / 2 - winW / 2,
                y: Math.abs(line.y1 - roomBBox.y) < thresholdM ? ry - thickPx / 2 : ry + rh - thickPx / 2,
                width: winW,
                height: thickPx,
                rotation: 0,
              });
              windowPlaced = true;
              break;
            }
          }
        } else {
          if (Math.abs(line.x1 - offsetM) < thresholdM) wallOrientation = 'V'; // Left (Vest/West)
          else wallOrientation = 'E'; // Right (Est/East)

          const touchesWall = Math.abs(line.x1 - roomBBox.x) < thresholdM || Math.abs(line.x1 - (roomBBox.x + roomBBox.w)) < thresholdM;
          if (touchesWall && roomBBox.y + roomBBox.h > line.y1 + thresholdM && roomBBox.y < line.y2 - thresholdM) {
            if (preferredOrientations.length === 0 || preferredOrientations.some(o => wallOrientation.includes(o) || (wallOrientation === 'V' && o === 'W'))) {
              const winH = Math.round(ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH * PIXELS_PER_METER);
              elements.push({
                id: uuidv4(),
                type: 'window',
                x: Math.abs(line.x1 - roomBBox.x) < thresholdM ? rx - thickPx / 2 : rx + rw - thickPx / 2,
                y: ry + rh / 2 - winH / 2,
                width: thickPx,
                height: winH,
                rotation: 0,
              });
              windowPlaced = true;
              break;
            }
          }
        }
      }

      // Secondary pass: If no window was placed (e.g. orientation impossible), place it on ANY exterior wall it touches
      if (!windowPlaced) {
        for (const line of outerWallLines) {
          const isHorizontal = Math.abs(line.y1 - line.y2) < 0.01;
          if (isHorizontal) {
            const touchesWall = Math.abs(line.y1 - roomBBox.y) < thresholdM || Math.abs(line.y1 - (roomBBox.y + roomBBox.h)) < thresholdM;
            if (touchesWall && roomBBox.x + roomBBox.w > line.x1 + thresholdM && roomBBox.x < line.x2 - thresholdM) {
              const winW = Math.round(ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH * PIXELS_PER_METER);
              elements.push({
                id: uuidv4(),
                type: 'window',
                x: rx + rw / 2 - winW / 2,
                y: Math.abs(line.y1 - roomBBox.y) < thresholdM ? ry - thickPx / 2 : ry + rh - thickPx / 2,
                width: winW, height: thickPx, rotation: 0
              });
              break;
            }
          } else {
            const touchesWall = Math.abs(line.x1 - roomBBox.x) < thresholdM || Math.abs(line.x1 - (roomBBox.x + roomBBox.w)) < thresholdM;
            if (touchesWall && roomBBox.y + roomBBox.h > line.y1 + thresholdM && roomBBox.y < line.y2 - thresholdM) {
              const winH = Math.round(ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH * PIXELS_PER_METER);
              elements.push({
                id: uuidv4(),
                type: 'window',
                x: Math.abs(line.x1 - roomBBox.x) < thresholdM ? rx - thickPx / 2 : rx + rw - thickPx / 2,
                y: ry + rh / 2 - winH / 2,
                width: thickPx, height: winH, rotation: 0
              });
              break;
            }
          }
        }
      }
    }
  }

  // 5.5. FIX — Problema 2: Add Terrace elements as single units OUTSIDE the house bounding box.
  // Each entry in terraceRooms → one terrace, centered at the bottom of the house.
  let terraceOffset = offsetM + heightM; // start at bottom edge of house
  for (const tr of terraceRooms) {
    const area = tr.minSqm && tr.maxSqm
      ? (tr.minSqm + tr.maxSqm) / 2
      : (tr.minSqm || tr.maxSqm || 15);
    const tw = Math.min(widthM * 0.6, 8); // max 8m width or 60% of house
    const th = area / tw;
    const tx = offsetM + (widthM / 2) - (tw / 2); // centered at bottom

    elements.push({
      id: tr.id,
      type: 'terasa',
      label: tr.label,
      x: Math.round(tx * PIXELS_PER_METER),
      y: Math.round(terraceOffset * PIXELS_PER_METER),
      width: Math.round(tw * PIXELS_PER_METER),
      height: Math.round(th * PIXELS_PER_METER),
      rotation: 0,
      wallThicknessCm: 0, // no walls for terrace
    });
    terraceOffset += th;
  }

  // 6. FIX — Problema 4: Automatically generate internal Doors with relaxed adjacency detection.
  // Increased gap tolerance from 0.05m to 0.4m (pixel rounding can shift rooms).
  // Reduced minimum overlap from 1.0m to 0.6m.
  const GAP_TOLERANCE = 0.4;    // meters - allow up to 40cm gap due to pixel rounding
  const MIN_OVERLAP = 0.6;       // meters - minimum shared wall length for a door
  const doorSizePx = Math.round(ARCHITECTURAL_STANDARDS.DOOR.RESIDENTIAL_INTERIOR * PIXELS_PER_METER);
  const createdDoors = new Set<string>();

  for (const room of indoorRooms) {
    if (!room.hasDoorTo || room.hasDoorTo.length === 0) continue;
    const roomP = partitionedRooms.find(r => r.id === room.id);
    if (!roomP) continue;

    for (const targetLabel of room.hasDoorTo) {
      const targetRoom = partitionedRooms.find(r => {
        const a = normalizeLabel(r.label);
        const b = normalizeLabel(targetLabel);
        // Match parțial în ambele direcții
        return a.includes(b) || b.includes(a) ||
          // Match pe primele 5 caractere ca fallback (e.g. "hol int..." === "hol p...")
          a.split('').slice(0, 5).join('') === b.split('').slice(0, 5).join('');
      });
      if (!targetRoom) continue;

      const pairId = [roomP.id, targetRoom.id].sort().join('-');
      if (createdDoors.has(pairId)) continue;

      // Try vertical shared wall (rooms side-by-side)
      const xDiff = Math.abs(roomP.bbox.x + roomP.bbox.w - targetRoom.bbox.x);
      const xDiffReverse = Math.abs(targetRoom.bbox.x + targetRoom.bbox.w - roomP.bbox.x);
      const overlapY = Math.min(roomP.bbox.y + roomP.bbox.h, targetRoom.bbox.y + targetRoom.bbox.h) -
                       Math.max(roomP.bbox.y, targetRoom.bbox.y);

      if ((xDiff < GAP_TOLERANCE || xDiffReverse < GAP_TOLERANCE) && overlapY >= MIN_OVERLAP) {
        const boundaryX = xDiff < xDiffReverse ? roomP.bbox.x + roomP.bbox.w : roomP.bbox.x;
        const startY = Math.max(roomP.bbox.y, targetRoom.bbox.y) + overlapY / 2 - 0.4;
        elements.push({
          id: uuidv4(),
          type: 'door',
          x: Math.round(boundaryX * PIXELS_PER_METER) - thickPx / 2,
          y: Math.round(startY * PIXELS_PER_METER),
          width: thickPx,
          height: doorSizePx,
          rotation: 0,
        });
        createdDoors.add(pairId);
        continue;
      }

      // Try horizontal shared wall (rooms stacked top/bottom)
      const yDiff = Math.abs(roomP.bbox.y + roomP.bbox.h - targetRoom.bbox.y);
      const yDiffReverse = Math.abs(targetRoom.bbox.y + targetRoom.bbox.h - roomP.bbox.y);
      const overlapX = Math.min(roomP.bbox.x + roomP.bbox.w, targetRoom.bbox.x + targetRoom.bbox.w) -
                       Math.max(roomP.bbox.x, targetRoom.bbox.x);

      if ((yDiff < GAP_TOLERANCE || yDiffReverse < GAP_TOLERANCE) && overlapX >= MIN_OVERLAP) {
        const boundaryY = yDiff < yDiffReverse ? roomP.bbox.y + roomP.bbox.h : roomP.bbox.y;
        const startX = Math.max(roomP.bbox.x, targetRoom.bbox.x) + overlapX / 2 - 0.4;
        elements.push({
          id: uuidv4(),
          type: 'door',
          x: Math.round(startX * PIXELS_PER_METER),
          y: Math.round(boundaryY * PIXELS_PER_METER) - thickPx / 2,
          width: doorSizePx,
          height: thickPx,
          rotation: 0,
        });
        createdDoors.add(pairId);
      }
    }
  }

  // 7. Add main entrance door
  const halls = partitionedRooms.filter(pr => {
    const r = indoorRooms.find(ar => ar.id === pr.id);
    return r?.isCirculation;
  });

  if (halls.length > 0) {
    const mainHall = halls[0];
    const hx = Math.round(mainHall.bbox.x * PIXELS_PER_METER);
    const hy = Math.round(mainHall.bbox.y * PIXELS_PER_METER);
    const hw = Math.round(mainHall.bbox.w * PIXELS_PER_METER);
    const hh = Math.round(mainHall.bbox.h * PIXELS_PER_METER);

    const extDoorSizePx = Math.round(ARCHITECTURAL_STANDARDS.DOOR.RESIDENTIAL_EXTERIOR * PIXELS_PER_METER);

    const touchesBottom = Math.abs(mainHall.bbox.y + mainHall.bbox.h - (offsetM + heightM)) < 0.05;
    const touchesTop = Math.abs(mainHall.bbox.y - offsetM) < 0.05;
    const touchesLeft = Math.abs(mainHall.bbox.x - offsetM) < 0.05;
    const touchesRight = Math.abs(mainHall.bbox.x + mainHall.bbox.w - (offsetM + widthM)) < 0.05;

    const street = (streetOrientation || 'S').toUpperCase();
    let doorPlaced = false;

    if ((street.includes('N') || street.includes('NE') || street.includes('NW') || street.includes('NORD')) && touchesTop) {
      elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
      doorPlaced = true;
    } else if ((street.includes('V') || street.includes('W') || street.includes('SV') || street.includes('NV') || street.includes('SW') || street.includes('NW') || street.includes('VEST')) && touchesLeft) {
      elements.push({ id: uuidv4(), type: 'door', x: hx - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
      doorPlaced = true;
    } else if ((street.includes('E') || street.includes('SE') || street.includes('NE') || street.includes('EST')) && touchesRight) {
      elements.push({ id: uuidv4(), type: 'door', x: hx + hw - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
      doorPlaced = true;
    } else if (touchesBottom) {
      elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy + hh - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
      doorPlaced = true;
    }

    if (!doorPlaced) {
      if (touchesBottom) elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy + hh - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
      else if (touchesTop) elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
      else if (touchesLeft) elements.push({ id: uuidv4(), type: 'door', x: hx - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
      else if (touchesRight) elements.push({ id: uuidv4(), type: 'door', x: hx + hw - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
    }
  }

  // 8. Generate Staircase
  const staircaseRoom = indoorRooms.find(ar => ar.hasStaircase);
  if (staircaseRoom) {
    const pr = partitionedRooms.find(r => r.id === staircaseRoom.id);
    if (pr) {
      const rx = Math.round(pr.bbox.x * PIXELS_PER_METER);
      const ry = Math.round(pr.bbox.y * PIXELS_PER_METER);
      const stairSize = Math.round(2 * PIXELS_PER_METER);
      elements.push({
        id: uuidv4(),
        type: 'staircase',
        x: rx + thickPx,
        y: ry + thickPx,
        width: stairSize,
        height: stairSize,
        rotation: 0,
      });
    }
  }

  console.log('Elements generated:', {
    total: elements.length,
    walls: elements.filter(e => e.type === 'wall').length,
    rooms: elements.filter(e => e.type === 'room').length,
    doors: elements.filter(e => e.type === 'door').length,
    windows: elements.filter(e => e.type === 'window').length,
    stairs: elements.filter(e => e.type === 'staircase').length,
    terraces: elements.filter(e => e.type === 'terasa').length,
  });

  return elements;
}
