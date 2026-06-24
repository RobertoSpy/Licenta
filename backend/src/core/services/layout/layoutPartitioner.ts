import { zoneBasedTreemap } from './zoneBasedTreemap';
import { generateOuterWalls } from './generators/wallGenerator';
import { generateWindows } from './generators/windowGenerator';
import { generateInternalDoors } from './generators/doorGenerator';
import { generateEntranceDoor } from './generators/entranceGenerator';

import { 
  CanvasElement, 
  ConfiguratorRoom, 
  ConfiguratorDimensions, 
  BBoxM, 
  ARCHITECTURAL_STANDARDS, 
  PIXELS_PER_METER,
  LAYOUT_CONSTANTS
} from './layoutTypes';

import { uuidv4, normalizeLabel, calculateShapeArea } from './layoutUtils';

// Re-export types so that consumers of layoutPartitioner don't break
export * from './layoutTypes';
export { calculateShapeArea } from './layoutUtils';

/**
 * Main function: partitions selected house shape footprint and returns list of canvas elements
 */
export function generateConfiguratorLayout(
  shape: string,
  dimensions: ConfiguratorDimensions,
  rooms: ConfiguratorRoom[],
  streetOrientation: string
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const offsetM = LAYOUT_CONSTANTS.offset_canvas_m; // Offset from canvas edge in meters

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

  // 2. Separate terraces BEFORE zone processing
  // Filtrăm terasele (folosind type-ul de la AI sau fallback pe label)
  const indoorRooms = rooms.filter(r => 
    r.type !== 'terasa' && 
    !normalizeLabel(r.label).startsWith('terasa') && 
    !r.label.toLowerCase().startsWith('teras')
  );
  const terraceRooms = rooms.filter(r => 
    r.type === 'terasa' || 
    normalizeLabel(r.label).startsWith('terasa') || 
    r.label.toLowerCase().startsWith('teras')
  );

  // 3. Distribute rooms to shape bounding boxes
  const partitionedRooms: Array<{ id: string; label: string; bbox: BBoxM; type?: string }> = [];

  if (shapesBBoxes.length === 1) {
    // Rectangle
    partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], indoorRooms, streetOrientation));
  } else {
    // L, U, or T - multiple bounding boxes
    // Grupare dinamică după zonele AI (fără hardcodări de "zi" sau "noapte")
    const zonesMap = new Map<string, ConfiguratorRoom[]>();
    for (const r of indoorRooms) {
      const z = r.zone?.toLowerCase() || 'default_zone';
      if (!zonesMap.has(z)) zonesMap.set(z, []);
      zonesMap.get(z)!.push(r);
    }
    
    // Sortăm zonele după numărul de camere (descrescător) ca să punem zona cea mai complexă în corpul principal (shapesBBoxes[0])
    const sortedZones = Array.from(zonesMap.values()).sort((a, b) => b.length - a.length);

    if (shape === 'l_shape' || shape === 't_shape') {
      if (sortedZones.length >= 2) {
        // Alocăm prima zonă către box 0, și restul către box 1
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], sortedZones[0], streetOrientation));
        const restRooms = sortedZones.slice(1).flat();
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], restRooms, streetOrientation));
      } else {
        const half = Math.ceil(indoorRooms.length / 2);
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], indoorRooms.slice(0, half), streetOrientation));
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], indoorRooms.slice(half), streetOrientation));
      }
    } else {
      // U-shape: 3 bounding boxes
      if (sortedZones.length >= 3) {
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], sortedZones[0], streetOrientation));
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], sortedZones[1], streetOrientation));
        const restRooms = sortedZones.slice(2).flat();
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[2], restRooms, streetOrientation));
      } else if (sortedZones.length === 2) {
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], sortedZones[0], streetOrientation)); // Centru
        
        const restRooms = sortedZones[1];
        const half = Math.ceil(restRooms.length / 2);
        if (half > 0) partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], restRooms.slice(0, half), streetOrientation));
        if (half < restRooms.length) partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[2], restRooms.slice(half), streetOrientation));
      } else {
        const third = Math.ceil(indoorRooms.length / 3);
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[0], indoorRooms.slice(0, third), streetOrientation));
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[1], indoorRooms.slice(third, 2 * third), streetOrientation));
        partitionedRooms.push(...zoneBasedTreemap(shapesBBoxes[2], indoorRooms.slice(2 * third), streetOrientation));
      }
    }
  }

  // --- ASSEMBLY ---

  // 4. Outer Walls
  elements.push(...generateOuterWalls(outerWallLines, thickPx));

  // 5. Room Elements
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
      metadata: {
        roomType: pr.type
      }
    });
  }

  // 6. Windows
  elements.push(...generateWindows(partitionedRooms, indoorRooms, outerWallLines, offsetM, thickPx));

  // 7. Terraces — always rendered, using fallback area if AI didn't set minSqm/maxSqm
  let terraceOffset = offsetM + heightM; // start at bottom edge of house
  for (const tr of terraceRooms) {
    // Nu mai sărim terasa — folosim fallback_sqm dacă AI nu a specificat suprafața
    const area = (tr.minSqm != null && tr.maxSqm != null)
      ? (tr.minSqm + tr.maxSqm) / 2
      : (tr.minSqm ?? tr.maxSqm ?? LAYOUT_CONSTANTS.terrace.fallback_sqm);
    const tw = Math.min(widthM * LAYOUT_CONSTANTS.terrace.max_width_ratio, LAYOUT_CONSTANTS.terrace.max_width_m);
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

  // 8. Internal Doors
  elements.push(...generateInternalDoors(shape, partitionedRooms, indoorRooms, thickPx));

  // 9. Main Entrance Door
  elements.push(...generateEntranceDoor(partitionedRooms, indoorRooms, dimensions, streetOrientation, offsetM, thickPx));

  // 10. Staircase
  const staircaseRoom = indoorRooms.find(ar => ar.hasStaircase);
  if (staircaseRoom) {
    const pr = partitionedRooms.find(r => r.id === staircaseRoom.id);
    if (pr) {
      const rx = Math.round(pr.bbox.x * PIXELS_PER_METER);
      const ry = Math.round(pr.bbox.y * PIXELS_PER_METER);
      const rw = Math.round(pr.bbox.w * PIXELS_PER_METER);
      const rh = Math.round(pr.bbox.h * PIXELS_PER_METER);
      const stairSize = Math.round(2 * PIXELS_PER_METER);
      
      // FIX: Centered the staircase in the room instead of pushing it rigidly in the top-left corner
      elements.push({
        id: uuidv4(),
        type: 'staircase',
        x: rx + (rw / 2) - (stairSize / 2),
        y: ry + (rh / 2) - (stairSize / 2),
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
