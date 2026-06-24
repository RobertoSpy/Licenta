import { CanvasElement, ConfiguratorRoom, BBoxM, ARCHITECTURAL_STANDARDS, PIXELS_PER_METER, LAYOUT_CONSTANTS } from '../layoutTypes';
import { uuidv4, normalizeLabel } from '../layoutUtils';

export function generateInternalDoors(
  shape: string,
  partitionedRooms: Array<{ id: string; label: string; bbox: BBoxM }>,
  indoorRooms: ConfiguratorRoom[],
  thickPx: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];

  // FIX: Increased GAP_TOLERANCE for complex shapes to account for Treemap floating point accumulation
  const GAP_TOLERANCE = shape === 'rectangle' ? LAYOUT_CONSTANTS.treemap.gap_tolerance_rectangle : LAYOUT_CONSTANTS.treemap.gap_tolerance_complex;
  
  const MIN_OVERLAP = LAYOUT_CONSTANTS.treemap.min_overlap_m;       // meters - minimum shared wall length for a door
  const doorSizePx = Math.round(ARCHITECTURAL_STANDARDS.DOOR.RESIDENTIAL_INTERIOR * PIXELS_PER_METER);
  const createdDoors = new Set<string>();

  // Helper pt limita usi
  const doorCounts: Record<string, number> = {};
  for (const pr of partitionedRooms) { doorCounts[pr.id] = 0; }
  
  function canAddDoor(roomId: string): boolean {
    const roomDef = indoorRooms.find(ar => ar.id === roomId);
    if (roomDef?.isCirculation || roomDef?.zone === 'distributie') return true;
    return (doorCounts[roomId] || 0) < LAYOUT_CONSTANTS.door.max_per_room;
  }
  
  function incrementDoor(r1: string, r2: string) {
    if (doorCounts[r1] !== undefined) doorCounts[r1]++;
    if (doorCounts[r2] !== undefined) doorCounts[r2]++;
  }

  // Pass 1: Defined Intentions
  for (const room of indoorRooms) {
    if (!room.hasDoorTo || room.hasDoorTo.length === 0) continue;
    const roomP = partitionedRooms.find(r => r.id === room.id);
    if (!roomP) continue;

    for (const targetLabel of room.hasDoorTo) {
      const targetRoom = partitionedRooms.find(r => {
        const a = normalizeLabel(r.label);
        const b = normalizeLabel(targetLabel);
        // FIX: Removed 5-char fallback to prevent false positives like "camera" vs "camara"
        return a.includes(b) || b.includes(a);
      });
      if (!targetRoom) continue;

      const pairId = [roomP.id, targetRoom.id].sort().join('-');
      if (createdDoors.has(pairId)) continue;
      
      if (!canAddDoor(roomP.id) || !canAddDoor(targetRoom.id)) continue;

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
        incrementDoor(roomP.id, targetRoom.id);
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
        incrementDoor(roomP.id, targetRoom.id);
      }
    }
  }

  // Pass 2: Fallback Geometric pentru camere izolate
  for (const room of indoorRooms) {
    const roomP = partitionedRooms.find(r => r.id === room.id);
    if (!roomP) continue;

    const hasAnyDoor = Array.from(createdDoors).some(pair => pair.includes(roomP.id));
    if (hasAnyDoor) continue;
    
    if (!canAddDoor(roomP.id)) continue;

    let bestNeighbor = null;
    let bestBoundary = null;

    for (const neighborP of partitionedRooms) {
      if (neighborP.id === roomP.id) continue;
      
      const neighborInfo = indoorRooms.find(r => r.id === neighborP.id);
      
      const xDiff = Math.abs(roomP.bbox.x + roomP.bbox.w - neighborP.bbox.x);
      const xDiffReverse = Math.abs(neighborP.bbox.x + neighborP.bbox.w - roomP.bbox.x);
      const overlapY = Math.min(roomP.bbox.y + roomP.bbox.h, neighborP.bbox.y + neighborP.bbox.h) - Math.max(roomP.bbox.y, neighborP.bbox.y);
      
      const yDiff = Math.abs(roomP.bbox.y + roomP.bbox.h - neighborP.bbox.y);
      const yDiffReverse = Math.abs(neighborP.bbox.y + neighborP.bbox.h - roomP.bbox.y);
      const overlapX = Math.min(roomP.bbox.x + roomP.bbox.w, neighborP.bbox.x + neighborP.bbox.w) - Math.max(roomP.bbox.x, neighborP.bbox.x);

      let boundary = null;
      if ((xDiff < GAP_TOLERANCE || xDiffReverse < GAP_TOLERANCE) && overlapY >= MIN_OVERLAP) {
        boundary = { 
          type: 'vertical', 
          x: xDiff < xDiffReverse ? roomP.bbox.x + roomP.bbox.w : roomP.bbox.x, 
          y: Math.max(roomP.bbox.y, neighborP.bbox.y) + overlapY / 2 - 0.4 
        };
      } else if ((yDiff < GAP_TOLERANCE || yDiffReverse < GAP_TOLERANCE) && overlapX >= MIN_OVERLAP) {
        boundary = { 
          type: 'horizontal', 
          y: yDiff < yDiffReverse ? roomP.bbox.y + roomP.bbox.h : roomP.bbox.y, 
          x: Math.max(roomP.bbox.x, neighborP.bbox.x) + overlapX / 2 - 0.4 
        };
      }

      if (boundary) {
        const isHol = neighborInfo?.zone === 'distributie';
        if (!bestNeighbor || isHol) {
          bestNeighbor = neighborP;
          bestBoundary = boundary;
          if (isHol) break; 
        }
      }
    }

    if (bestNeighbor && bestBoundary) {
      if (bestBoundary.type === 'vertical') {
        elements.push({
          id: uuidv4(), type: 'door', 
          x: Math.round(bestBoundary.x * PIXELS_PER_METER) - thickPx / 2, 
          y: Math.round(bestBoundary.y * PIXELS_PER_METER), 
          width: thickPx, height: doorSizePx, rotation: 0
        });
      } else {
        elements.push({
          id: uuidv4(), type: 'door', 
          x: Math.round(bestBoundary.x * PIXELS_PER_METER), 
          y: Math.round(bestBoundary.y * PIXELS_PER_METER) - thickPx / 2, 
          width: doorSizePx, height: thickPx, rotation: 0
        });
      }
      createdDoors.add([roomP.id, bestNeighbor.id].sort().join('-'));
      incrementDoor(roomP.id, bestNeighbor.id);
    }
  }

  return elements;
}
