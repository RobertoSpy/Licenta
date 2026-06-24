// backend/src/lib/planMetricsExtractor.ts
//
// Extrage metrici geometrice reale din PlanSnapshot (JSON salvat de editor).
// Înlocuiește estimările forfetare din bomService.ts cu date reale.
//
// Structura snapshot (definită în frontend/src/hooks/useEditorState.ts):
//   { elements: CanvasElement[], timestamp: number }
//   CanvasElement: { id, type: 'room'|'wall'|'door'|'window'|'staircase', x, y, width, height, rotation, label?, wallThicknessCm?, metadata? }
//
// SCALE: 1 pixel canvas = 5cm real → PIXELS_PER_METER = 20 (useEditorState.ts linia 13)

import { ProjectMetrics } from '../modules/bom/bomService';
import { LAYOUT_CONSTANTS } from '../core/services/layout/layoutTypes';

// ─────────────────────────────────────────────────────────────────
// CONSTANTĂ DE SCARĂ — sincronizată cu frontend/src/hooks/useEditorState.ts
// ─────────────────────────────────────────────────────────────────
const PIXELS_PER_METER = 20;

// ─────────────────────────────────────────────────────────────────
// TIPURI INTERNE
// ─────────────────────────────────────────────────────────────────

interface RawElement {
  id: string;
  type: 'room' | 'wall' | 'door' | 'window' | 'staircase' | string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  label?: string;
  wallThicknessCm?: number;
  metadata?: Record<string, unknown>;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ─────────────────────────────────────────────────────────────────
// HELPER — bounding box a unui set de elemente
// ─────────────────────────────────────────────────────────────────
function getBoundingBox(elements: RawElement[]): BoundingBox | null {
  if (elements.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY };
}

// ─────────────────────────────────────────────────────────────────
// HELPER — detectare ușă exterioară prin poziție față de bounding box
//
// O ușă este considerată exterioară dacă centrul ei se află în apropierea
// (< 2*GRID_SIZE = 40px) marginii exterioare a ansamblului de camere.
// Lipsa câmpului metadata.isExterior în snapshot — deducem geometric.
// ─────────────────────────────────────────────────────────────────
const EXTERIOR_THRESHOLD_PX = 15; // 15px = 0.75 metri (toleranță mult mai strictă)

function isExteriorDoor(door: RawElement, bbox: BoundingBox, baseWalls: RawElement[] = []): boolean {
  // Dacă metadata spune explicit → prioritate
  if (door.metadata?.isExterior === true) return true;
  if (door.metadata?.isExterior === false) return false;

  const cx = door.x + door.width / 2;
  const cy = door.y + door.height / 2;

  // Detecție precisă: dacă există elemente 'wall' (care reprezintă conturul exterior),
  // ușa e exterioară doar dacă se intersectează cu unul dintre aceste ziduri.
  if (baseWalls.length > 0) {
    for (const w of baseWalls) {
       const wx1 = w.x - EXTERIOR_THRESHOLD_PX;
       const wy1 = w.y - EXTERIOR_THRESHOLD_PX;
       const wx2 = w.x + w.width + EXTERIOR_THRESHOLD_PX;
       const wy2 = w.y + w.height + EXTERIOR_THRESHOLD_PX;
       if (cx >= wx1 && cx <= wx2 && cy >= wy1 && cy <= wy2) {
         return true;
       }
    }
    return false; // Nu atinge niciun zid exterior
  }

  // Fallback pentru backward compatibility: deducem din poziția pe marginea bounding box-ului
  return (
    cx <= bbox.minX + EXTERIOR_THRESHOLD_PX ||
    cx >= bbox.maxX - EXTERIOR_THRESHOLD_PX ||
    cy <= bbox.minY + EXTERIOR_THRESHOLD_PX ||
    cy >= bbox.maxY - EXTERIOR_THRESHOLD_PX
  );
}

// ─────────────────────────────────────────────────────────────────
// HELPER — suprafața unui element de tip 'window' sau 'door' în mp
// (pentru calculul golurilor exterioare din zidărie)
// ─────────────────────────────────────────────────────────────────
function openingAreaSqm(el: RawElement): number {
  const planLengthM = Math.max(el.width, el.height) / PIXELS_PER_METER;
  const heightM = el.type === 'window'
    ? LAYOUT_CONSTANTS.window.standard_height_m
    : LAYOUT_CONSTANTS.door.standard_height_m;
  return parseFloat((planLengthM * heightM).toFixed(3));
}

// ─────────────────────────────────────────────────────────────────
// HELPER — lungimea unui perete în metri
// ─────────────────────────────────────────────────────────────────
function wallLengthM(wall: RawElement): number {
  // Pereții pot fi atât orizontali cât și verticali:
  // dimensiunea dominantă = lungimea, dimensiunea mică = grosimea
  const longSide = Math.max(wall.width, wall.height);
  return parseFloat((longSide / PIXELS_PER_METER).toFixed(3));
}

// ─────────────────────────────────────────────────────────────────
// EXTRACTOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────

export interface ExtractionResult {
  metrics: ProjectMetrics;
  /** true dacă datele provin din snapshot real; false dacă sunt estimări forfetare. */
  fromSnapshot: boolean;
  /** Mesaj pentru logging — descrie ce s-a extras și ce s-a estimat. */
  diagnosticNote: string;
}

/**
 * Extrage ProjectMetrics din conținutul unui PlanSnapshot (planJSON).
 *
 * @param planJSONs - Array cu conținutul câmpurilor planJSON din DB (pentru fiecare etaj)
 * @param floorsCount - Numărul de etaje al proiectului (pentru scalare valori per etaj)
 */
export function extractMetricsFromSnapshot(
  planJSONs: unknown[],
  floorsCount: number
): ExtractionResult {
  const FALLBACK_NOTE = '[BOM] Snapshot-uri lipsă sau invalide → metrici estimate forfetare (40m perimetru, 100mp/etaj).';

  // ── Guard: validare structurală minimă a snapshot-urilor ──────────
  if (!Array.isArray(planJSONs) || planJSONs.length === 0) {
    console.warn(FALLBACK_NOTE);
    return buildFallback(floorsCount, FALLBACK_NOTE);
  }

  // Colectăm toate elementele de pe toate etajele salvate (sumare exactă a golurilor)
  const allElements = planJSONs.flatMap(json => {
    if (json && typeof json === 'object' && Array.isArray((json as any).elements)) {
      return (json as any).elements as RawElement[];
    }
    return [];
  });

  // Pentru calcul de footprint (amprenta), considerăm baza (primul snapshot cu camere, de obicei parterul)
  let baseElements = (planJSONs[0] as any)?.elements as RawElement[] || [];
  if (baseElements.filter(e => e.type === 'room').length === 0) {
     const nextValid = planJSONs.find(j => Array.isArray((j as any)?.elements) && (j as any).elements.some((e: any) => e.type === 'room'));
     if (nextValid) baseElements = (nextValid as any).elements;
  }

  const baseRooms = baseElements.filter(e => e.type === 'room');

  // ── Guard: cel puțin o cameră trebuie să existe la sol ────────────────
  if (baseRooms.length === 0) {
    const note = '[BOM] Niciun snapshot nu conține camere → metrici estimate forfetare.';
    console.warn(note);
    return buildFallback(floorsCount, note);
  }

  // ── Bounding box al parterului ────────────────────────────────────────
  const bbox = getBoundingBox(baseRooms)!;

  // ── Perimetru (Pereți Exteriori la sol) ───────────────────────────────
  const baseWalls = baseElements.filter(e => e.type === 'wall');

  const bboxWidthM = (bbox.maxX - bbox.minX) / PIXELS_PER_METER;
  const bboxHeightM = (bbox.maxY - bbox.minY) / PIXELS_PER_METER;

  let perimeterM = 0;
  if (baseWalls.length > 0) {
    perimeterM = parseFloat(baseWalls.reduce((sum, w) => sum + wallLengthM(w), 0).toFixed(2));
  } else {
    perimeterM = parseFloat((2 * (bboxWidthM + bboxHeightM)).toFixed(2));
  }

  // ── Suprafața totală a parterului (suma suprafețelor camerelor) ──
  let roomsPerimeterM = 0;
  const parterAreaSqm = baseRooms.reduce((sum, r) => {
    const wM = r.width / PIXELS_PER_METER;
    const hM = r.height / PIXELS_PER_METER;
    roomsPerimeterM += 2 * (wM + hM);
    return sum + (wM * hM);
  }, 0);
  const totalFloorAreaSqm = parseFloat((parterAreaSqm * floorsCount).toFixed(2));

  // ── Pereți interiori la sol ─────────────────────────────────────────────
  let interiorWallsM = (roomsPerimeterM - perimeterM) / 2;
  const virtualWallsLengthM = baseElements
    .filter(e => e.type === 'wall' && e.metadata?.isVirtualBoundary === true)
    .reduce((sum, w) => sum + wallLengthM(w), 0);
  interiorWallsM -= virtualWallsLengthM;

  if (interiorWallsM < 0) interiorWallsM = 0;
  interiorWallsM = parseFloat(interiorWallsM.toFixed(2));

  // ── Uși și ferestre (Numărate EXACT de pe TOATE etajele) ──────────────────────────
  const doors = allElements.filter(e => e.type === 'door');
  const windows = allElements.filter(e => e.type === 'window');

  // Nu mai înmulțim cu floorsCount! Numărăm exact ce a desenat utilizatorul pe fiecare etaj.
  const countWindows = windows.length;
  const exteriorDoors = doors.filter(d => isExteriorDoor(d, bbox, baseWalls));
  const countExteriorDoors = exteriorDoors.length;
  let countInteriorDoors = doors.length - countExteriorDoors;
  if (countInteriorDoors < 0) countInteriorDoors = 0;

  const countDoors = countExteriorDoors + countInteriorDoors;

  // ── Suprafața golurilor exterioare (din toate etajele) ──
  const exteriorOpeningsSqm = parseFloat((
    windows.reduce((s, w) => s + openingAreaSqm(w), 0) +
    exteriorDoors.reduce((s, d) => s + openingAreaSqm(d), 0)
  ).toFixed(2));

  // ── Stâlpișori structurali (Geometrie Colțuri + Goluri) ─────────
  const cornerSet = new Set<string>();
  for (const room of baseRooms) {
    const rx = Math.round(room.x);
    const ry = Math.round(room.y);
    const rw = Math.round(room.width);
    const rh = Math.round(room.height);
    cornerSet.add(`${rx},${ry}`);
    cornerSet.add(`${rx + rw},${ry}`);
    cornerSet.add(`${rx},${ry + rh}`);
    cornerSet.add(`${rx + rw},${ry + rh}`);
  }
  // Colțurile se duc în sus pe fiecare etaj, golurile sunt adunate deja din toate etajele.
  const countCorners = (cornerSet.size * floorsCount) + (countWindows + countExteriorDoors) * 2;

  const diagnosticNote = [
    `[BOM] Metrici extrase din snapshot-uri reale (${planJSONs.length} etaje găsite):`,
    `  exteriorWalls=${perimeterM}m (bounding box ${bboxWidthM.toFixed(1)}×${bboxHeightM.toFixed(1)}m, ${baseWalls.length} elemente trasate la sol)`,
    `  totalFloorArea=${totalFloorAreaSqm}mp (${baseRooms.length} camere × ${floorsCount} etaje)`,
    `  interiorWalls=${interiorWallsM}m (calculate matematic)`,
    `  doors=${countDoors} (ext=${countExteriorDoors}, int=${countInteriorDoors}), windows=${countWindows} (numărate din toate etajele)`,
    `  exteriorOpenings=${exteriorOpeningsSqm}mp`,
    `  corners=${countCorners} (unice=${cornerSet.size}, goluri=${countWindows + countExteriorDoors})`
  ].join('\n');

  console.log(diagnosticNote);

  return {
    fromSnapshot: true,
    diagnosticNote,
    metrics: {
      perimeterM,
      totalFloorAreaSqm,
      interiorWallsM,
      floorsCount,
      floorHeightM: 2.70, // Standard rezidențial; poate deveni parametru de proiect în v2
      seismicZone: '',     // Completat de bomService din project.seismicZone
      foundationDepthM: 0, // Placeholder
      foundationWidthM: 0, // Placeholder
      countDoors,
      countExteriorDoors,
      countInteriorDoors,
      countWindows,
      countCorners,
      exteriorOpeningsSqm,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// FALLBACK — estimare forfetară când snapshot-ul lipsește
// ─────────────────────────────────────────────────────────────────

function buildFallback(
  floorsCount: number,
  note: string
): ExtractionResult {
  return {
    fromSnapshot: false,
    diagnosticNote: note,
    metrics: {
      perimeterM: 40,                   // casă dreptunghiulară 10×10m
      totalFloorAreaSqm: 100 * floorsCount,
      interiorWallsM: 20 * floorsCount,
      floorsCount,
      floorHeightM: 2.70,
      seismicZone: '',
      foundationDepthM: 0,
      foundationWidthM: 0,
      countDoors: 5 * floorsCount,
      countExteriorDoors: 1,
      countInteriorDoors: 4 * floorsCount,
      countWindows: 6 * floorsCount,
      countCorners: 4 + (6 * floorsCount + 1) * 2, // 4 colțuri + 2 per fereastră/ușă ext
      exteriorOpeningsSqm: 15,                   // ~15mp goluri tipice
    },
  };
}
