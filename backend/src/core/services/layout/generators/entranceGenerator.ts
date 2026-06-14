import { CanvasElement, ConfiguratorRoom, BBoxM, ARCHITECTURAL_STANDARDS, PIXELS_PER_METER, ConfiguratorDimensions, LAYOUT_CONSTANTS } from '../layoutTypes';
import { uuidv4 } from '../layoutUtils';

export function generateEntranceDoor(
  partitionedRooms: Array<{ id: string; label: string; bbox: BBoxM }>,
  indoorRooms: ConfiguratorRoom[],
  dimensions: ConfiguratorDimensions,
  streetOrientation: string,
  offsetM: number,
  thickPx: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  
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

    // FIX: Increased threshold to 0.15 for floating point accumulation on complex shapes
    const TOUCHES_THRESHOLD = LAYOUT_CONSTANTS.treemap.touches_threshold_m;
    
    const touchesBottom = Math.abs(mainHall.bbox.y + mainHall.bbox.h - (offsetM + dimensions.heightM)) < TOUCHES_THRESHOLD;
    const touchesTop = Math.abs(mainHall.bbox.y - offsetM) < TOUCHES_THRESHOLD;
    const touchesLeft = Math.abs(mainHall.bbox.x - offsetM) < TOUCHES_THRESHOLD;
    const touchesRight = Math.abs(mainHall.bbox.x + mainHall.bbox.w - (offsetM + dimensions.widthM)) < TOUCHES_THRESHOLD;

    const street = streetOrientation.toUpperCase();

    if ((street.includes('N') || street.includes('NE') || street.includes('NW') || street.includes('NORD')) && touchesTop) {
      elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
    } else if ((street.includes('V') || street.includes('W') || street.includes('SV') || street.includes('NV') || street.includes('SW') || street.includes('NW') || street.includes('VEST')) && touchesLeft) {
      elements.push({ id: uuidv4(), type: 'door', x: hx - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
    } else if ((street.includes('E') || street.includes('SE') || street.includes('NE') || street.includes('EST')) && touchesRight) {
      elements.push({ id: uuidv4(), type: 'door', x: hx + hw - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
    } else if ((street.includes('S') || street.includes('SUD')) && touchesBottom) {
      elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy + hh - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
    } else {
      // Fallback: pune ușa pe orice perete atinge holul
      if (touchesBottom) elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy + hh - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
      else if (touchesTop) elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
      else if (touchesLeft) elements.push({ id: uuidv4(), type: 'door', x: hx - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
      else if (touchesRight) elements.push({ id: uuidv4(), type: 'door', x: hx + hw - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
    }
  }

  return elements;
}
