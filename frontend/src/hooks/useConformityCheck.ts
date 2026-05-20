import { useMemo, useRef, useEffect, useState } from 'react';
import { type RoomInfo } from './useRoomCalculator';
import { apiPrivate } from '../api/axios';

// ─────────────────────────────────────────────────────────────────
// useConformityCheck
//
// Extras din ProjectEditor pentru a respecta arhitectura modulară
// specificată în plan_faza2.md.
//
// Responsabilități:
//   1. Filtrează violările (status === 'error') cu debounce 2s
//      — nu re-evaluăm la fiecare keystroke drag, ci după ce
//        utilizatorul a terminat de redimensionat camera
//   2. Detectează când violările s-au schimbat față de evaluarea
//      anterioară (pentru a nu re-declanșa AI-ul la același set)
//   3. Expune `hasWarnings` (status === 'warning') pentru panel lateral
// ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 2_000; // 2s după ultima modificare canvas

export interface ConformityState {
  rooms: ConformityRoom[];
  /** Camere cu suprafață sub limita legală (status === 'error') */
  violations: ConformityRoom[];
  /** Camere aproape de limită (status === 'warning', 90-100% din minim) */
  warnings: ConformityRoom[];
  /** Reguli încălcate (orice tip: camere, uși, proiect) */
  violationIssues: ConformityRuleIssue[];
  /** Recomandări (warning) pentru reguli suplimentare */
  warningIssues: ConformityRuleIssue[];
  /** true în intervalul debounce — util pt spinner în UI */
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

export function useConformityCheck(
  rooms: RoomInfo[],
  doors?: ConformityDoorInput[]
): ConformityState {
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const [results, setResults] = useState<Record<string, { status: ConformityRoom['conformityStatus']; minRequiredSqm?: number }>>({});
  const [violationIssues, setViolationIssues] = useState<ConformityRuleIssue[]>([]);
  const [warningIssues, setWarningIssues] = useState<ConformityRuleIssue[]>([]);

  // Generăm o cheie stabilă din rooms pentru a detecta schimbări reale
  const roomsKey = rooms
    .map((r) => `${r.id}:${r.usableSqm}:${r.label ?? ''}`)
    .join('|');

  const doorsKey = (doors ?? [])
    .map((d) => `${d.id}:${d.widthM}`)
    .join('|');

  const validationKey = `${roomsKey}::${doorsKey}`;

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
      const payload = {
        rooms: rooms.map((r) => ({
          id: r.id,
          label: r.label,
          usableSqm: r.usableSqm,
          widthM: r.widthM,
          heightM: r.heightM,
        })),
        doors: doors?.map((d) => ({
          id: d.id,
          widthM: d.widthM,
        })),
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
    // roomsKey ca dependency string stabil — nu array object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationKey]);

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

  return {
    rooms: roomsWithStatus,
    violations,
    warnings,
    violationIssues,
    warningIssues,
    isPending,
  };
}
