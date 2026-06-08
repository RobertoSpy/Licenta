import { useMemo, useRef, useEffect, useState } from 'react';
import { type RoomInfo } from './useRoomCalculator';
import { type CanvasElement } from './useEditorState';
import { apiPrivate } from '../api/axios';

// ─────────────────────────────────────────────────────────────────
// useConformityCheck
//
// Responsabilități:
//   1. Validare suprafete minime (Legea 114/1996) prin request la backend
//      cu debounce 2s
//   2. Reguli geometrice locale privind deschiderile — fara request:
//      DOOR_OVERLAP   — 2 uși cu centrele < 20px distanță → error
//      TOO_MANY_DOORS — o cameră are > 2 uși → warning
//      NO_WINDOW      — cameră de zi (living/dormitor) fără nicio fereastră → warning
// ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 2_000;
const OVERLAP_THRESHOLD_PX = 20;

export interface ConformityState {
  rooms: ConformityRoom[];
  violations: ConformityRoom[];
  warnings: ConformityRoom[];
  violationIssues: ConformityRuleIssue[];
  warningIssues: ConformityRuleIssue[];
  isPending: boolean;
}

export interface ConformityRoom extends RoomInfo {
  conformityStatus: 'ok' | 'warning' | 'error';
  minRequiredSqm?: number;
}

export interface ConformityDoorInput {
  id: string;
  widthM: number;
}

export interface ConformityRuleIssue {
  targetType: 'room' | 'door' | 'project';
  targetId: string;
  code: string;
  severity: 'warning' | 'error';
  article: string;
  message: string;
  currentValue: number;
  requiredValue: number;
  deltaValue: number;
  suggestion: string;
  sources?: Array<{ source: string; chapter: string; excerpt: string }>;
}

// ─── Helper: normalize Romanian room label ───────────────────────
function normLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isHabitableRoom(label: string): boolean {
  const n = normLabel(label);
  if (n.includes('tehnic') || n.includes('debara') || n.includes('camara') || n.includes('baie') || n.includes('wc') || n.includes('hol') || n.includes('coridor')) {
    return false;
  }
  return n.includes('living') || n.includes('sufragerie') || n.includes('dormitor') || n.includes('birou') || n.includes('bucatarie') || n.includes('camera');
}

// ─── Geometric opening rules (100% local, no backend) ────────────
function computeOpeningIssues(
  rooms: RoomInfo[],
  elements: CanvasElement[]
): ConformityRuleIssue[] {
  const issues: ConformityRuleIssue[] = [];
  const doors = elements.filter(el => el.type === 'door');
  const windows = elements.filter(el => el.type === 'window');

  // RULE 1 — DOOR_OVERLAP: any 2 doors whose centers are < threshold apart
  for (let i = 0; i < doors.length; i++) {
    for (let j = i + 1; j < doors.length; j++) {
      const a = doors[i], b = doors[j];
      const dist = Math.hypot(
        (a.x + a.width / 2) - (b.x + b.width / 2),
        (a.y + a.height / 2) - (b.y + b.height / 2)
      );
      if (dist < OVERLAP_THRESHOLD_PX) {
        issues.push({
          targetType: 'door',
          targetId: a.id,
          code: 'DOOR_OVERLAP',
          severity: 'error',
          article: 'Art. 1 — Reguli geometrice',
          message: `Două uși sunt suprapuse (distanța centrelor: ${dist.toFixed(0)}px). Îndepărtați sau ștergeți una.`,
          currentValue: dist,
          requiredValue: OVERLAP_THRESHOLD_PX,
          deltaValue: OVERLAP_THRESHOLD_PX - dist,
          suggestion: 'Ștergeți ușa suprapusă din panoul Proprietăți sau repoziționați-o.',
        });
      }
    }
  }

  // RULE 2 — TOO_MANY_DOORS: a room with > 2 doors becomes a corridor
  for (const room of rooms) {
    const roomEl = elements.find(el => el.id === room.id);
    if (!roomEl) continue;

    const adjacentDoors = doors.filter(door => {
      const cx = door.x + door.width / 2;
      const cy = door.y + door.height / 2;
      return (
        cx >= roomEl.x - 15 && cx <= roomEl.x + roomEl.width + 15 &&
        cy >= roomEl.y - 15 && cy <= roomEl.y + roomEl.height + 15
      );
    });

    const norm = normLabel(room.label ?? '');
    const isCorridor = ['hol', 'coridor', 'vestibul', 'circulatie', 'circulație', 'antreu', 'sas', 'degajament'].some(k => norm.includes(k));

    if (adjacentDoors.length > 2 && !isCorridor) {
      issues.push({
        targetType: 'room',
        targetId: room.id,
        code: 'TOO_MANY_DOORS',
        severity: 'warning',
        article: 'Bună practică arhitecturală',
        message: `Camera "${room.label}" are ${adjacentDoors.length} uși. Camerele cu > 2 uși devin spații de trecere și pierd caracterul de cameră locuibilă.`,
        currentValue: adjacentDoors.length,
        requiredValue: 2,
        deltaValue: adjacentDoors.length - 2,
        suggestion: 'Reduceți numărul de uși la maximum 2 per cameră.',
      });
    }
  }

  // RULE 3 — NO_WINDOW: habitable room without any adjacent window
  for (const room of rooms) {
    if (!isHabitableRoom(room.label ?? '')) continue;

    const roomEl = elements.find(el => el.id === room.id);
    if (!roomEl) continue;

    const adjacentWindows = windows.filter(win => {
      return (
        win.x <= roomEl.x + roomEl.width + 30 &&
        win.x + win.width >= roomEl.x - 30 &&
        win.y <= roomEl.y + roomEl.height + 30 &&
        win.y + win.height >= roomEl.y - 30
      );
    });

    if (adjacentWindows.length === 0) {
      issues.push({
        targetType: 'room',
        targetId: room.id,
        code: 'NO_WINDOW',
        severity: 'warning',
        article: 'Legea 114/1996, Art. 4 — Iluminat natural',
        message: `Camera "${room.label}" nu are nicio fereastră spre exterior. Legea locuinței impune iluminat natural pentru spațiile locuibile.`,
        currentValue: 0,
        requiredValue: 1,
        deltaValue: 1,
        suggestion: 'Adăugați cel puțin o fereastră pe un perete exterior din panoul Proprietăți.',
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────

export function useConformityCheck(
  rooms: RoomInfo[],
  doors?: ConformityDoorInput[],
  elements?: CanvasElement[],
  buildingPurpose?: string
): ConformityState {
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const [results, setResults] = useState<Record<string, { status: ConformityRoom['conformityStatus']; minRequiredSqm?: number }>>({});
  const [violationIssues, setViolationIssues] = useState<ConformityRuleIssue[]>([]);
  const [warningIssues, setWarningIssues] = useState<ConformityRuleIssue[]>([]);

  // ── Local geometric opening rules (no backend, no debounce) ──────
  const localOpeningIssues = useMemo<ConformityRuleIssue[]>(() => {
    if (!elements || elements.length === 0) return [];
    return computeOpeningIssues(rooms, elements);
  }, [rooms, elements]);

  // Stable keys for effect dependencies
  const roomsKey = rooms.map((r) => `${r.id}:${r.usableSqm}:${r.label ?? ''}`).join('|');
  const doorsKey = (doors ?? []).map((d) => `${d.id}:${d.widthM}`).join('|');
  const windowsKey = (elements ?? []).filter(e => e.type === 'window').map(w => `${w.id}:${w.width}:${w.height}:${w.x}:${w.y}`).join('|');
  const validationKey = `${roomsKey}::${doorsKey}::${windowsKey}::${buildingPurpose ?? 'residential'}`;

  // ── Backend conformity check (debounced 2s) ───────────────────────
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (rooms.length === 0) {
      setResults({});
      setViolationIssues([]);
      setWarningIssues([]);
      setIsPending(false);
      return;
    }

    setIsPending(true);
    const currentRequestId = ++requestIdRef.current;

    timerRef.current = setTimeout(() => {
      // Find all windows
      const windows = elements?.filter(e => e.type === 'window') ?? [];

      const payload = {
        rooms: rooms.map((r) => {
          // Calculate windowAreaSqm
          let windowAreaSqm = 0;
          let hasExteriorAccess = false;
          const roomEl = elements?.find(el => el.id === r.id);
          if (roomEl) {
            const adjacentWindows = windows.filter(win => {
              // Folosim intersecția de tip Bounding Box (AABB) cu o marjă generoasă de 100px
              return (
                win.x <= roomEl.x + roomEl.width + 100 &&
                win.x + win.width >= roomEl.x - 100 &&
                win.y <= roomEl.y + roomEl.height + 100 &&
                win.y + win.height >= roomEl.y - 100
              );
            });
            
            // PxToMeters conversion logic is usually room.widthM / roomEl.width
            // Or we just calculate meters directly. We assume standard window height 1.5m
            for (const win of adjacentWindows) {
              const scale = (r.widthM || 1) / (roomEl.width || 1); // pixels to meters scale for this room
              const winWidthM = Math.max(win.width || 0, win.height || 0) * scale;
              if (!Number.isNaN(winWidthM)) {
                windowAreaSqm += winWidthM * 1.5; // WINDOW_STANDARD_HEIGHT_M = 1.5
              }
            }
            if (Number.isNaN(windowAreaSqm)) windowAreaSqm = 0;
            
            // Verificăm dacă are acces la exterior (atinge o fereastră sau o ușă de exterior)
            const adjacentDoors = elements?.filter(e => e.type === 'door').filter(doorEl => {
              const cx = doorEl.x + doorEl.width / 2;
              const cy = doorEl.y + doorEl.height / 2;
              return (
                cx >= roomEl.x - 15 && cx <= roomEl.x + roomEl.width + 15 &&
                cy >= roomEl.y - 15 && cy <= roomEl.y + roomEl.height + 15
              );
            }) ?? [];
            
            // O ușă e exterioară dacă atinge < 2 camere
            const hasExteriorDoor = adjacentDoors.some(doorEl => {
               const cx = doorEl.x + doorEl.width / 2;
               const cy = doorEl.y + doorEl.height / 2;
               const intersectingRooms = elements?.filter(el => el.type === 'room' && 
                   cx >= el.x - 15 && cx <= el.x + el.width + 15 &&
                   cy >= el.y - 15 && cy <= el.y + el.height + 15
               ) ?? [];
               return intersectingRooms.length < 2;
            });
            
            hasExteriorAccess = adjacentWindows.length > 0 || hasExteriorDoor;
          }

          return {
            id: r.id,
            label: r.label,
            usableSqm: r.usableSqm,
            widthM: r.widthM,
            heightM: r.heightM,
            windowAreaSqm,
            hasExteriorAccess,
          };
        }),
        doors: doors?.map((d) => {
          const doorEl = elements?.find(el => el.id === d.id);
          let isExterior = false;
          if (doorEl) {
             if (doorEl.metadata?.isMainEntrance) {
               isExterior = true;
             } else {
               // Fallback geometric: Check how many rooms it intersects
               const cx = doorEl.x + doorEl.width / 2;
               const cy = doorEl.y + doorEl.height / 2;
               const intersectingRooms = elements?.filter(el => {
                 if (el.type !== 'room') return false;
                 return (
                   cx >= el.x - 15 && cx <= el.x + el.width + 15 &&
                   cy >= el.y - 15 && cy <= el.y + el.height + 15
                 );
               }) ?? [];
               // If it intersects < 2 rooms, it's an exterior door
               isExterior = intersectingRooms.length < 2;
             }
          }
          return { id: d.id, widthM: d.widthM, isExterior };
        }),
        buildingPurpose: buildingPurpose ?? 'residential',
      };

      apiPrivate
        .post('/editor/validate-conformity', payload)
        .then(({ data }) => {
          if (currentRequestId !== requestIdRef.current) return;
          const next: Record<string, { status: ConformityRoom['conformityStatus']; minRequiredSqm?: number }> = {};
          for (const room of data.rooms ?? []) {
            next[room.id] = { status: room.status, minRequiredSqm: room.minRequiredSqm };
          }
          setResults(next);
          setViolationIssues(data.violations ?? []);
          setWarningIssues(data.warnings ?? []);
        })
        .catch((err) => {
          if (currentRequestId !== requestIdRef.current) return;
          console.error('[useConformityCheck] Eroare validare:', err);
          setResults({});
          setViolationIssues([]);
          setWarningIssues([]);
        })
        .finally(() => {
          if (currentRequestId !== requestIdRef.current) return;
          setIsPending(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationKey]);

  // ── Merge results ─────────────────────────────────────────────────
  const roomsWithStatus = useMemo<ConformityRoom[]>(
    () => rooms.map((room) => ({
      ...room,
      conformityStatus: results[room.id]?.status ?? 'ok',
      minRequiredSqm: results[room.id]?.minRequiredSqm,
    })),
    [rooms, results]
  );

  const violations = useMemo(
    () => roomsWithStatus.filter((r) => r.conformityStatus === 'error'),
    [roomsWithStatus]
  );

  const warnings = useMemo(
    () => roomsWithStatus.filter((r) => r.conformityStatus === 'warning'),
    [roomsWithStatus]
  );

  // Merge local opening issues with backend issues
  const allViolationIssues = useMemo(
    () => [
      ...violationIssues,
      ...localOpeningIssues.filter(i => i.severity === 'error'),
    ],
    [violationIssues, localOpeningIssues]
  );

  const allWarningIssues = useMemo(
    () => [
      ...warningIssues,
      ...localOpeningIssues.filter(i => i.severity === 'warning'),
    ],
    [warningIssues, localOpeningIssues]
  );

  return {
    rooms: roomsWithStatus,
    violations,
    warnings,
    violationIssues: allViolationIssues,
    warningIssues: allWarningIssues,
    isPending,
  };
}
