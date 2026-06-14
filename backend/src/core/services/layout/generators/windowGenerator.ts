import { CanvasElement, ConfiguratorRoom, BBoxM, ARCHITECTURAL_STANDARDS, PIXELS_PER_METER, LAYOUT_CONSTANTS } from '../layoutTypes';
import { uuidv4, normalizeLabel } from '../layoutUtils';

export function generateWindows(
  partitionedRooms: Array<{ id: string; label: string; bbox: BBoxM }>,
  indoorRooms: ConfiguratorRoom[],
  outerWallLines: Array<{ x1: number; y1: number; x2: number; y2: number }>,
  offsetM: number,
  thickPx: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const thresholdM = LAYOUT_CONSTANTS.treemap.touches_threshold_m; // Mărit pentru L/U/T shapes din cauza floating point errors de la treemap

  for (const pr of partitionedRooms) {
    const roomDef = indoorRooms.find(ar => ar.id === pr.id);
    if (!roomDef || !roomDef.naturalLight) continue;

    const roomBBox = pr.bbox;
    const rx = Math.round(pr.bbox.x * PIXELS_PER_METER);
    const ry = Math.round(pr.bbox.y * PIXELS_PER_METER);
    const rw = Math.round(pr.bbox.w * PIXELS_PER_METER);
    const rh = Math.round(pr.bbox.h * PIXELS_PER_METER);

    const preferredOrientations = roomDef.orientation || [];

    // Calculate dynamic window width to satisfy conformity rules (NP057)
    // Încăperile de locuit (zi + noapte) primesc raport de 1/8 (0.125), restul 1/10 (0.1)
    const isHabitableConformity = roomDef.zone === 'zi' || roomDef.zone === 'noapte';
    const requiredRatio = isHabitableConformity ? LAYOUT_CONSTANTS.window.day_room_ratio : LAYOUT_CONSTANTS.window.night_room_ratio;
    const targetWindowAreaSqm = roomBBox.w * roomBBox.h * requiredRatio;
    
    // Standard window height is 1.5m. We add 5% margin to ensure it passes.
    const standardHeight = LAYOUT_CONSTANTS.window.standard_height_m;
    const requiredWinWidthM = Math.ceil(((targetWindowAreaSqm / standardHeight) * 1.05) * 10) / 10;

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
            const maxWinWidthM = roomBBox.w - 0.4;
            const finalWinWidthM = Math.min(Math.max(ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH, requiredWinWidthM), Math.max(0.6, maxWinWidthM));
            const winW = Math.round(finalWinWidthM * PIXELS_PER_METER);
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
            const maxWinWidthM = roomBBox.h - 0.4;
            const finalWinWidthM = Math.min(Math.max(ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH, requiredWinWidthM), Math.max(0.6, maxWinWidthM));
            const winH = Math.round(finalWinWidthM * PIXELS_PER_METER);
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
            const maxWinWidthM = roomBBox.w - 0.4;
            const finalWinWidthM = Math.min(Math.max(ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH, requiredWinWidthM), Math.max(0.6, maxWinWidthM));
            const winW = Math.round(finalWinWidthM * PIXELS_PER_METER);
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
            const maxWinWidthM = roomBBox.h - 0.4;
            const finalWinWidthM = Math.min(Math.max(ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH, requiredWinWidthM), Math.max(0.6, maxWinWidthM));
            const winH = Math.round(finalWinWidthM * PIXELS_PER_METER);
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

  return elements;
}
