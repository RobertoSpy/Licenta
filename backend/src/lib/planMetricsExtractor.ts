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
const EXTERIOR_THRESHOLD_PX = 40; // 2 celule de grid = 2 metri

function isExteriorDoor(door: RawElement, bbox: BoundingBox): boolean {
  // Dacă metadata spune explicit → prioritate
  if (door.metadata?.isExterior === true) return true;
  if (door.metadata?.isExterior === false) return false;

  // Deducem din poziție: ușa exterioară e pe marginea bounding box-ului
  const cx = door.x + door.width / 2;
  const cy = door.y + door.height / 2;
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
  const wM = el.width / PIXELS_PER_METER;
  const hM = el.height / PIXELS_PER_METER;
  // Înălțimea standard dacă elementul e orientat orizontal (pe perete vertical)
  // fereastra: min 1.0m înălțime; ușa: min 2.0m înălțime
  if (wM < 0.1 || hM < 0.1) return 0; // dimensiune degenerat-0, ignorăm
  return parseFloat((wM * hM).toFixed(3));
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
 * @param planJSON - Conținutul câmpului planJSON din DB (parsabil ca { elements: RawElement[] })
 * @param floorsCount - Numărul de etaje al proiectului (pentru scalare valori per etaj)
 * @param foundationDepthM - Adâncimea fundației (calculată de contextMultiplierEngine)
 * @param foundationWidthM - Lățimea fundației (calculată de contextMultiplierEngine)
 */
export function extractMetricsFromSnapshot(
  planJSON: unknown,
  floorsCount: number,
  foundationDepthM: number,
  foundationWidthM: number
): ExtractionResult {
  const FALLBACK_NOTE = '[BOM] Snapshot lipsă sau invalid → metrici estimate forfetare (40m perimetru, 100mp/etaj).';

  // ── Guard: validare structurală minimă a snapshot-ului ──────────
  if (
    !planJSON ||
    typeof planJSON !== 'object' ||
    !Array.isArray((planJSON as any).elements)
  ) {
    console.warn(FALLBACK_NOTE);
    return buildFallback(floorsCount, foundationDepthM, foundationWidthM, FALLBACK_NOTE);
  }

  const elements: RawElement[] = (planJSON as any).elements as RawElement[];
  const rooms = elements.filter(e => e.type === 'room');

  // ── Guard: cel puțin o cameră trebuie să existe ────────────────
  if (rooms.length === 0) {
    const note = '[BOM] Snapshot fără camere → metrici estimate forfetare.';
    console.warn(note);
    return buildFallback(floorsCount, foundationDepthM, foundationWidthM, note);
  }

  // ── Bounding box ────────────────────────────────────────────────
  const bbox = getBoundingBox(rooms)!;

  // ── Perimetru (Pereți Exteriori) ──────────────────────────────────
  // Frontend-ul generează elemente de type 'wall' strict pentru conturul exterior (perimeter).
  const walls = elements.filter(e => e.type === 'wall');
  
  const bboxWidthM  = (bbox.maxX - bbox.minX) / PIXELS_PER_METER;
  const bboxHeightM = (bbox.maxY - bbox.minY) / PIXELS_PER_METER;
  
  let perimeterM = 0;
  if (walls.length > 0) {
    // Calcul exact bazat pe pereții exteriori desenați (funcționează perfect pt forme complexe L, U, T)
    perimeterM = parseFloat(walls.reduce((sum, w) => sum + wallLengthM(w), 0).toFixed(2));
  } else {
    // Fallback pentru backward compatibility
    perimeterM  = parseFloat((2 * (bboxWidthM + bboxHeightM)).toFixed(2));
  }

  // ── Suprafața totală a parterului (suma suprafețelor camerelor) ──
  let roomsPerimeterM = 0;
  const parterAreaSqm = rooms.reduce((sum, r) => {
    const wM = r.width / PIXELS_PER_METER;
    const hM = r.height / PIXELS_PER_METER;
    roomsPerimeterM += 2 * (wM + hM);
    return sum + (wM * hM);
  }, 0);
  const totalFloorAreaSqm = parseFloat((parterAreaSqm * floorsCount).toFixed(2));

  // ── Pereți interiori ─────────────────────────────────────────────
  // Formula geometrică exactă: Suma perimetrelor tuturor camerelor = Perimetrul Exterior + 2 * Pereții Interiori
  // (pereții interiori sunt segmentați și împărțiți exact de 2 camere, deci apar de 2 ori în suma perimetrelor)
  let interiorWallsM = (roomsPerimeterM - perimeterM) / 2;
  if (interiorWallsM < 0) interiorWallsM = 0;
  interiorWallsM = parseFloat(interiorWallsM.toFixed(2));

  // ── Uși și ferestre ─────────────────────────────────────────────
  const doors   = elements.filter(e => e.type === 'door');
  const windows = elements.filter(e => e.type === 'window');

  const countWindows = windows.length;
  const exteriorDoors = doors.filter(d => isExteriorDoor(d, bbox));
  const countExteriorDoors = exteriorDoors.length;
  const countInteriorDoors = doors.length - countExteriorDoors;
  const countDoors = doors.length;

  // ── Suprafața golurilor exterioare (ferestre + uși exterioare) ──
  // Scăzută din suprafața brută a pereților exteriori în formula 'wall_exterior'
  const exteriorOpeningsSqm = parseFloat((
    windows.reduce((s, w) => s + openingAreaSqm(w), 0) +
    exteriorDoors.reduce((s, d) => s + openingAreaSqm(d), 0)
  ).toFixed(2));

  const diagnosticNote = [
    `[BOM] Metrici extrase din snapshot real:`,
    `  perimeterM=${perimeterM}m (bounding box ${bboxWidthM.toFixed(1)}×${bboxHeightM.toFixed(1)}m)`,
    `  totalFloorArea=${totalFloorAreaSqm}mp (${rooms.length} camere × ${floorsCount} etaje)`,
    `  interiorWalls=${interiorWallsM}m (${walls.length} elemente perete)`,
    `  doors=${countDoors} (ext=${countExteriorDoors}, int=${countInteriorDoors}), windows=${countWindows}`,
    `  exteriorOpenings=${exteriorOpeningsSqm}mp`,
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
      foundationDepthM,
      foundationWidthM,
      countDoors,
      countExteriorDoors,
      countInteriorDoors,
      countWindows,
      exteriorOpeningsSqm,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// FALLBACK — estimare forfetară când snapshot-ul lipsește
// ─────────────────────────────────────────────────────────────────

function buildFallback(
  floorsCount: number,
  foundationDepthM: number,
  foundationWidthM: number,
  note: string
): ExtractionResult {
  return {
    fromSnapshot: false,
    diagnosticNote: note,
    metrics: {
      perimeterM:           40,                   // casă dreptunghiulară 10×10m
      totalFloorAreaSqm:    100 * floorsCount,
      interiorWallsM:       20 * floorsCount,
      floorsCount,
      floorHeightM:         2.70,
      seismicZone:          '',
      foundationDepthM,
      foundationWidthM,
      countDoors:           5 * floorsCount,
      countExteriorDoors:   1,
      countInteriorDoors:   4 * floorsCount,
      countWindows:         6 * floorsCount,
      exteriorOpeningsSqm:  15,                   // ~15mp goluri tipice
    },
  };
}
