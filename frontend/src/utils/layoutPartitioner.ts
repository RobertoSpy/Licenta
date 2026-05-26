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

/**
 * Checks if a room belongs to the "Day Zone" (living, kitchen, hall, storage)
 */
function isDayRoom(label: string): boolean {
  const norm = normalizeLabel(label);
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

/**
 * Generates an optimized partition layout of a rectangular box into multiple rooms.
 * Uses a column-based partition layout (Slice-and-Dice).
 */
function partitionRectangle(bbox: BBoxM, rooms: ConfiguratorRoom[]): Array<{ id: string; label: string; bbox: BBoxM }> {
  if (rooms.length === 0) return [];
  if (rooms.length === 1) {
    return [{ id: rooms[0].id, label: rooms[0].label, bbox }];
  }

  // Sort rooms to put Entrance/Halls first, then Living/Kitchen, then Bedrooms/Bathrooms
  const sortedRooms = [...rooms].sort((a, b) => {
    const labelA = normalizeLabel(a.label);
    const labelB = normalizeLabel(b.label);
    const score = (l: string) => {
      if (l.includes('hol') || l.includes('antreu') || l.includes('vestibul')) return 1;
      if (l.includes('living') || l.includes('sufragerie')) return 2;
      if (l.includes('bucatarie')) return 3;
      if (l.includes('dormitor') || l.includes('camera')) return 4;
      if (l.includes('baie') || l.includes('wc')) return 5;
      return 6;
    };
    return score(labelA) - score(labelB);
  });

  // Decide number of columns
  const numCols = rooms.length <= 3 ? 1 : (rooms.length <= 6 ? 2 : 3);
  
  // Distribute rooms to columns to balance weights (ratios)
  const columns: ConfiguratorRoom[][] = Array.from({ length: numCols }, () => []);
  const colWeights = new Array(numCols).fill(0);

  for (const r of sortedRooms) {
    // Find column with minimum weight
    let minColIdx = 0;
    let minWeight = colWeights[0];
    for (let i = 1; i < numCols; i++) {
      if (colWeights[i] < minWeight) {
        minWeight = colWeights[i];
        minColIdx = i;
      }
    }
    columns[minColIdx].push(r);
    colWeights[minColIdx] += r.ratioValue;
  }

  // Remove empty columns if any
  const activeCols = columns.filter(c => c.length > 0);
  const activeWeights = activeCols.map(c => c.reduce((sum, r) => sum + r.ratioValue, 0));
  const totalWeight = activeWeights.reduce((sum, w) => sum + w, 0);

  const partitionedRooms: Array<{ id: string; label: string; bbox: BBoxM }> = [];
  let currentX = bbox.x;

  for (let i = 0; i < activeCols.length; i++) {
    const colRooms = activeCols[i];
    const colWeight = activeWeights[i];
    const colWidth = (colWeight / totalWeight) * bbox.w;

    let currentY = bbox.y;
    const colTotalRoomWeight = colRooms.reduce((sum, r) => sum + r.ratioValue, 0);

    for (let j = 0; j < colRooms.length; j++) {
      const room = colRooms[j];
      const roomHeight = (room.ratioValue / colTotalRoomWeight) * bbox.h;

      partitionedRooms.push({
        id: room.id,
        label: room.label,
        bbox: {
          x: currentX,
          y: currentY,
          w: colWidth,
          h: roomHeight,
        },
      });

      currentY += roomHeight;
    }

    currentX += colWidth;
  }

  return partitionedRooms;
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
    // Left vertical wing + bottom horizontal wing
    // Left: W_wing x H_tot
    // Bottom-right: (W_tot - W_wing) x L_wing
    const w1 = Math.min(wingWidthM, widthM - 2);
    const h2 = Math.min(wingLengthM, heightM - 2);

    const leftWing = {
      x: offsetM,
      y: offsetM,
      w: w1,
      h: heightM,
    };
    const rightWing = {
      x: offsetM + w1,
      y: offsetM + heightM - h2,
      w: widthM - w1,
      h: h2,
    };

    shapesBBoxes.push(leftWing, rightWing);

    // Outline walls
    const xM = offsetM;
    const yM = offsetM;

    outerWallLines.push({ x1: xM, y1: yM, x2: xM + w1, y2: yM }); // Top left wing
    outerWallLines.push({ x1: xM + w1, y1: yM, x2: xM + w1, y2: yM + heightM - h2 }); // Inner angle vertical
    outerWallLines.push({ x1: xM + w1, y1: yM + heightM - h2, x2: xM + widthM, y2: yM + heightM - h2 }); // Inner angle horizontal
    outerWallLines.push({ x1: xM + widthM, y1: yM + heightM - h2, x2: xM + widthM, y2: yM + heightM }); // Right end
    outerWallLines.push({ x1: xM, y1: yM + heightM, x2: xM + widthM, y2: yM + heightM }); // Bottom wall
    outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + heightM }); // Left wall
  } else if (shape === 'u_shape') {
    // Left Wing, Right Wing, Bottom connector
    const w1 = Math.min(wingWidthM, widthM / 2.5);
    const h2 = Math.min(wingLengthM, heightM - 2);

    const leftWing = {
      x: offsetM,
      y: offsetM,
      w: w1,
      h: heightM,
    };
    const centerWing = {
      x: offsetM + w1,
      y: offsetM + heightM - h2,
      w: widthM - 2 * w1,
      h: h2,
    };
    const rightWing = {
      x: offsetM + widthM - w1,
      y: offsetM,
      w: w1,
      h: heightM,
    };

    shapesBBoxes.push(leftWing, centerWing, rightWing);

    // Outline walls
    const xM = offsetM;
    const yM = offsetM;

    outerWallLines.push({ x1: xM, y1: yM, x2: xM + w1, y2: yM }); // Top Left wing
    outerWallLines.push({ x1: xM + w1, y1: yM, x2: xM + w1, y2: yM + heightM - h2 }); // Inner left vertical
    outerWallLines.push({ x1: xM + w1, y1: yM + heightM - h2, x2: xM + widthM - w1, y2: yM + heightM - h2 }); // Inner horizontal
    outerWallLines.push({ x1: xM + widthM - w1, y1: yM + heightM - h2, x2: xM + widthM - w1, y2: yM }); // Inner right vertical
    outerWallLines.push({ x1: xM + widthM - w1, y1: yM, x2: xM + widthM, y2: yM }); // Top Right wing
    outerWallLines.push({ x1: xM + widthM, y1: yM, x2: xM + widthM, y2: yM + heightM }); // Right wall
    outerWallLines.push({ x1: xM, y1: yM + heightM, x2: xM + widthM, y2: yM + heightM }); // Bottom wall
    outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + heightM }); // Left wall
  } else {
    // t_shape
    // Top Horizontal wing: W_tot x L_wing
    // Bottom Stem wing: W_wing x (H_tot - L_wing) centered
    const h1 = Math.min(wingLengthM, heightM / 2.2);
    const w2 = Math.min(wingWidthM, widthM - 2);
    const stemX = offsetM + (widthM - w2) / 2;

    const topWing = {
      x: offsetM,
      y: offsetM,
      w: widthM,
      h: h1,
    };
    const stemWing = {
      x: stemX,
      y: offsetM + h1,
      w: w2,
      h: heightM - h1,
    };

    shapesBBoxes.push(topWing, stemWing);

    // Outline walls
    const xM = offsetM;
    const yM = offsetM;

    outerWallLines.push({ x1: xM, y1: yM, x2: xM + widthM, y2: yM }); // Top wall
    outerWallLines.push({ x1: xM + widthM, y1: yM, x2: xM + widthM, y2: yM + h1 }); // Right edge top wing
    outerWallLines.push({ x1: stemX + w2, y1: yM + h1, x2: xM + widthM, y2: yM + h1 }); // Under right top wing
    outerWallLines.push({ x1: stemX + w2, y1: yM + h1, x2: stemX + w2, y2: yM + heightM }); // Right side of stem
    outerWallLines.push({ x1: stemX, y1: yM + heightM, x2: stemX + w2, y2: yM + heightM }); // Bottom of stem
    outerWallLines.push({ x1: stemX, y1: yM + h1, x2: stemX, y2: yM + heightM }); // Left side of stem
    outerWallLines.push({ x1: xM, y1: yM + h1, x2: stemX, y2: yM + h1 }); // Under left top wing
    outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + h1 }); // Left edge top wing
  }

  // 2. Adjust room weights based on Area constraints
  const totalAreaM2 = shapesBBoxes.reduce((sum, box) => sum + (box.w * box.h), 0);
  const adjustedRooms = rooms.map(room => ({
    ...room,
    ratioValue: clampWeightRatio(room.ratioValue, room.minSqm ?? 0, room.maxSqm ?? 1000, totalAreaM2)
  }));

  // 3. Distribute rooms to shape bounding boxes
  const partitionedRooms: Array<{ id: string; label: string; bbox: BBoxM }> = [];

  if (shapesBBoxes.length === 1) {
    // Rectangle
    partitionedRooms.push(...partitionRectangle(shapesBBoxes[0], adjustedRooms));
  } else {
    // L, U, or T - multiple bounding boxes
    // Group rooms by Zone: Day vs Night
    const dayRooms = adjustedRooms.filter(r => isDayRoom(r.label));
    const nightRooms = adjustedRooms.filter(r => !isDayRoom(r.label));

    if (shape === 'l_shape' || shape === 't_shape') {
      // 2 bounding boxes: 0 is main/top, 1 is side/stem
      // Assign Day rooms to 0, Night rooms to 1.
      // If one is empty, divide 50/50.
      if (dayRooms.length > 0 && nightRooms.length > 0) {
        partitionedRooms.push(...partitionRectangle(shapesBBoxes[0], dayRooms));
        partitionedRooms.push(...partitionRectangle(shapesBBoxes[1], nightRooms));
      } else {
        const half = Math.ceil(adjustedRooms.length / 2);
        partitionedRooms.push(...partitionRectangle(shapesBBoxes[0], adjustedRooms.slice(0, half)));
        partitionedRooms.push(...partitionRectangle(shapesBBoxes[1], adjustedRooms.slice(half)));
      }
    } else {
      // U-shape: 3 bounding boxes: 0 (left), 1 (center/bottom), 2 (right)
      // Assign rooms: Day rooms to center (1), Night rooms divided between left (0) and right (2)
      if (dayRooms.length > 0) {
        partitionedRooms.push(...partitionRectangle(shapesBBoxes[1], dayRooms));
        
        // Split night rooms between Left and Right wings
        const half = Math.ceil(nightRooms.length / 2);
        const leftRooms = nightRooms.slice(0, half);
        const rightRooms = nightRooms.slice(half);

        if (leftRooms.length > 0) partitionedRooms.push(...partitionRectangle(shapesBBoxes[0], leftRooms));
        if (rightRooms.length > 0) partitionedRooms.push(...partitionRectangle(shapesBBoxes[2], rightRooms));
      } else {
        // Divide all rooms evenly
        const third = Math.ceil(adjustedRooms.length / 3);
        partitionedRooms.push(...partitionRectangle(shapesBBoxes[0], adjustedRooms.slice(0, third)));
        partitionedRooms.push(...partitionRectangle(shapesBBoxes[1], adjustedRooms.slice(third, 2 * third)));
        partitionedRooms.push(...partitionRectangle(shapesBBoxes[2], adjustedRooms.slice(2 * third)));
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

    elements.push({
      id: pr.id,
      type: 'room',
      label: pr.label,
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      rotation: 0,
      wallThicknessCm: ARCHITECTURAL_STANDARDS.WALL.EXTERIOR_THICKNESS * 100,
    });

    // 5. Generate automated Windows on exterior walls
    const roomDef = adjustedRooms.find(ar => ar.id === pr.id);
    if (roomDef && roomDef.naturalLight) {
      const roomBBox = pr.bbox;
      const thresholdM = 0.05;
      const preferredOrientations = roomDef.orientation || [];

      for (const line of outerWallLines) {
        const isHorizontal = Math.abs(line.y1 - line.y2) < 0.01;
        let wallOrientation = '';

        if (isHorizontal) {
          if (Math.abs(line.y1 - offsetM) < thresholdM) wallOrientation = 'N'; // Top
          else wallOrientation = 'S'; // Bottom
          
          const touchesWall = Math.abs(line.y1 - roomBBox.y) < thresholdM || Math.abs(line.y1 - (roomBBox.y + roomBBox.h)) < thresholdM;
          if (touchesWall && roomBBox.x + roomBBox.w > line.x1 + thresholdM && roomBBox.x < line.x2 - thresholdM) {
            // Only place if it matches preferred orientation OR if no preferred orientation is set
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
              break; // One window per room is usually enough
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
              break; // One window per room is usually enough
            }
          }
        }
      }
    }
  }

  // 6. Automatically generate internal Doors
  const doorSizePx = Math.round(ARCHITECTURAL_STANDARDS.DOOR.RESIDENTIAL_INTERIOR * PIXELS_PER_METER);
  const createdDoors = new Set<string>();

  for (const room of adjustedRooms) {
    if (!room.hasDoorTo || room.hasDoorTo.length === 0) continue;
    const roomP = partitionedRooms.find(r => r.id === room.id);
    if (!roomP) continue;

    for (const targetLabel of room.hasDoorTo) {
      const targetRoom = partitionedRooms.find(r => normalizeLabel(r.label).includes(normalizeLabel(targetLabel)));
      if (!targetRoom) continue;

      const pairId = [roomP.id, targetRoom.id].sort().join('-');
      if (createdDoors.has(pairId)) continue;

      const xDiff = Math.abs(roomP.bbox.x + roomP.bbox.w - targetRoom.bbox.x);
      const xDiffReverse = Math.abs(targetRoom.bbox.x + targetRoom.bbox.w - roomP.bbox.x);
      const overlapY = Math.min(roomP.bbox.y + roomP.bbox.h, targetRoom.bbox.y + targetRoom.bbox.h) - Math.max(roomP.bbox.y, targetRoom.bbox.y);

      if ((xDiff < 0.05 || xDiffReverse < 0.05) && overlapY > 1.0) {
        const boundaryX = xDiff < 0.05 ? roomP.bbox.x + roomP.bbox.w : roomP.bbox.x;
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

      const yDiff = Math.abs(roomP.bbox.y + roomP.bbox.h - targetRoom.bbox.y);
      const yDiffReverse = Math.abs(targetRoom.bbox.y + targetRoom.bbox.h - roomP.bbox.y);
      const overlapX = Math.min(roomP.bbox.x + roomP.bbox.w, targetRoom.bbox.x + targetRoom.bbox.w) - Math.max(roomP.bbox.x, targetRoom.bbox.x);

      if ((yDiff < 0.05 || yDiffReverse < 0.05) && overlapX > 1.0) {
        const boundaryY = yDiff < 0.05 ? roomP.bbox.y + roomP.bbox.h : roomP.bbox.y;
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
    const r = adjustedRooms.find(ar => ar.id === pr.id);
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
  const staircaseRoom = adjustedRooms.find(ar => ar.hasStaircase);
  if (staircaseRoom) {
    const pr = partitionedRooms.find(r => r.id === staircaseRoom.id);
    if (pr) {
      const rx = Math.round(pr.bbox.x * PIXELS_PER_METER);
      const ry = Math.round(pr.bbox.y * PIXELS_PER_METER);
      // Create a 2x2m staircase roughly in the corner of the room
      const stairSize = Math.round(2 * PIXELS_PER_METER);
      elements.push({
        id: uuidv4(),
        type: 'stairs',
        x: rx + thickPx,
        y: ry + thickPx,
        width: stairSize,
        height: stairSize,
        rotation: 0,
      });
    }
  }

  console.log('Elements generate:', {
    total: elements.length,
    walls: elements.filter(e => e.type === 'wall').length,
    rooms: elements.filter(e => e.type === 'room').length,
    doors: elements.filter(e => e.type === 'door').length,
    windows: elements.filter(e => e.type === 'window').length,
    stairs: elements.filter(e => e.type === 'stairs').length,
  });

  return elements;
}

// Ajustare weightRatio ca suprafața să respecte min/max
function clampWeightRatio(
  weightRatio: number,
  minSqm: number,
  maxSqm: number,
  totalArea: number
): number {
  const totalWeight = 10; // suma tuturor weightRatio-urilor (aproximativ)
  const resultSqm = (weightRatio / totalWeight) * totalArea;
  
  if (resultSqm < minSqm) {
    return (minSqm / totalArea) * totalWeight;
  }
  if (resultSqm > maxSqm) {
    return (maxSqm / totalArea) * totalWeight;
  }
  return weightRatio;
}
