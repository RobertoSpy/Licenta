// frontend/src/hooks/useBOMPhaseWizard.ts
//
// Orchestrează starea locală a wizard-ului BOM pe faze.
// Grupează bomItems[] pe etape conform mapării formulaKey → BomPhaseKey.
// Sincronizează completedPhases cu DB via useBOMAdvisorChat.

import { useMemo, useCallback } from 'react';
import type { BOMItem } from './useBOMData';
import { useBOMAdvisorChat } from './useBOMAdvisorChat';

// ─────────────────────────────────────────────────────────────────
// TIPURI
// ─────────────────────────────────────────────────────────────────

export type BomPhaseKey =
  | 'fundatie'
  | 'structura'
  | 'planseu'
  | 'acoperis'
  | 'finisaje'
  | 'tamplarie'
  | 'termoizolatie'
  | 'instalatii_electrice'
  | 'instalatii_sanitare';

export interface BomPhaseConfig {
  key: BomPhaseKey;
  label: string;
  labelRo: string;
  icon: string;
  emptyNote: string;
}

// ─────────────────────────────────────────────────────────────────
// CONFIGURARE FAZE — ordinea este ordinea canonică de construcție
// ─────────────────────────────────────────────────────────────────

export const PHASE_CONFIG: BomPhaseConfig[] = [
  {
    key: 'fundatie',
    label: 'Fundație',
    labelRo: 'Etapa 1 — Fundație',
    icon: '🏗️',
    emptyNote: 'Nu s-au calculat materiale de fundație. Verificați dacă proiectul are un plan 2D publicat.',
  },
  {
    key: 'structura',
    label: 'Structură',
    labelRo: 'Etapa 2 — Structură (Zidărie & Armături)',
    icon: '🧱',
    emptyNote: 'Nu s-au calculat materiale de structură.',
  },
  {
    key: 'planseu',
    label: 'Planșeu',
    labelRo: 'Etapa 3 — Planșeu & Coroană',
    icon: '🧩',
    emptyNote: 'Nu s-au calculat materiale de planșeu (se aplică doar pentru P+1 sau mai mult).',
  },
  {
    key: 'acoperis',
    label: 'Acoperiș',
    labelRo: 'Etapa 4 — Acoperiș (Șarpantă & Învelitoare)',
    icon: '🏚️',
    emptyNote: 'Nu s-au calculat materiale de acoperiș.',
  },
  {
    key: 'finisaje',
    label: 'Finisaje',
    labelRo: 'Etapa 5 — Finisaje (Brute & Fine)',
    icon: '🎨',
    emptyNote: 'Nu s-au calculat materiale de finisaje.',
  },
  {
    key: 'tamplarie',
    label: 'Tâmplărie',
    labelRo: 'Etapa 6 — Tâmplărie (Ferestre & Uși)',
    icon: '🪟',
    emptyNote: 'Nu s-au calculat materiale de tâmplărie.',
  },
  {
    key: 'termoizolatie',
    label: 'Termoizolație',
    labelRo: 'Etapa 7 — Termoizolație & Hidroizolație',
    icon: '🧊',
    emptyNote: 'Nu s-au calculat materiale de termoizolație.',
  },
  {
    key: 'instalatii_electrice',
    label: 'Instalații Electrice',
    labelRo: 'Etapa 8 — Instalații Electrice',
    icon: '⚡',
    emptyNote: 'Materialele electrice se stabilesc de regulă cu electricianul.',
  },
  {
    key: 'instalatii_sanitare',
    label: 'Instalații Sanitare și Termice',
    labelRo: 'Etapa 9 — Instalații Sanitare și Termice',
    icon: '💧',
    emptyNote: 'Materialele sanitare și termice se stabilesc de regulă cu instalatorul.',
  },
];

// ─────────────────────────────────────────────────────────────────
// MAPARE formulaKey → BomPhaseKey
// Sursa de adevăr: bom-formulas.json (field "phase")
// Mapăm după câmpul `phase` din BOMItem, nu după formulaKey
// (mai robust față de adăugarea de formule noi)
// ─────────────────────────────────────────────────────────────────

const PHASE_LABEL_MAP: Record<string, BomPhaseKey> = {
  // Mapare câmp `phase` (din BOMItem.phase) → BomPhaseKey
  'Fundație':       'fundatie',
  'Structură':      'structura',
  'Planșeu':        'planseu',
  'Acoperiș':       'acoperis',
  'Finisaje':       'finisaje',
  'Tâmplărie':      'tamplarie',
  'Termoizolație':  'termoizolatie',
  'Instalații Electrice': 'instalatii_electrice',
  'Instalații Sanitare și Termice': 'instalatii_sanitare',
  // Legacies just in case
  'Instalații Sanitare': 'instalatii_sanitare',
  'Finisaje Brute': 'finisaje',
};

// ─────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────

export function useBOMPhaseWizard(projectId: string, bomItems: BOMItem[], chatState: any) {
  // Starea etapelor din DB (activePhase, completedPhases, confirmPhase)
  const {
    activePhase: dbActivePhase,
    completedPhases,
    confirmPhase: confirmPhaseInDB,
  } = chatState;

  // Grupăm itemii pe faze (memoizat pentru performanță)
  const phaseItems = useMemo(() => {
    const grouped: Record<BomPhaseKey, BOMItem[]> = {
      fundatie:   [],
      structura:  [],
      planseu:    [],
      acoperis:   [],
      finisaje:   [],
      tamplarie:  [],
      termoizolatie: [],
      instalatii_electrice: [],
      instalatii_sanitare: [],
    };

    for (const item of bomItems) {
      const phaseKey = PHASE_LABEL_MAP[item.phase];
      if (phaseKey && grouped[phaseKey]) {
        grouped[phaseKey].push(item);
      } else {
        // fallback: dacă phase-ul nu e mapat, îl punem la finisaje
        console.warn(`[useBOMPhaseWizard] Phase nemapat: "${item.phase}" pentru ${item.formulaKey}`);
        grouped.finisaje.push(item);
      }
    }

    return grouped;
  }, [bomItems]);

  // Totalul per fază
  const totalByPhase = useMemo(() => {
    const totals: Record<BomPhaseKey, number> = {
      fundatie: 0,
      structura: 0,
      planseu: 0,
      acoperis: 0,
      finisaje: 0,
      tamplarie: 0,
      termoizolatie: 0,
      instalatii_electrice: 0,
      instalatii_sanitare: 0,
    };
    for (const key of Object.keys(totals) as BomPhaseKey[]) {
      totals[key] = phaseItems[key].reduce((s, i) => s + i.totalPrice, 0);
    }
    return totals;
  }, [phaseItems]);

  // Total general
  const grandTotal = useMemo(
    () => Object.values(totalByPhase).reduce((s, v) => s + v, 0),
    [totalByPhase]
  );

  // Etapa activă: folosim cea din DB, dar dacă lipsește, prima netrecută
  const activePhase: BomPhaseKey = useMemo(() => {
    if (dbActivePhase && PHASE_CONFIG.some(p => p.key === dbActivePhase)) {
      return dbActivePhase as BomPhaseKey;
    }
    // Prima etapă neconfirmată
    for (const phase of PHASE_CONFIG) {
      if (!completedPhases.includes(phase.key)) return phase.key;
    }
    return 'instalatii_sanitare'; // toate confirmate — rămânem pe ultima
  }, [dbActivePhase, completedPhases]);

  // Toate etapele confirmate?
  const allPhasesConfirmed = PHASE_CONFIG.every(p => completedPhases.includes(p.key));

  // Navighează la o etapă specifică (doar dacă e accesibilă)
  const goToPhase = useCallback((key: BomPhaseKey) => {
    // Utilizatorul poate naviga la orice etapă confirmată + etapa activă
    const isAccessible = completedPhases.includes(key) || key === activePhase;
    if (!isAccessible) return;
    // Nu avem setare locală — schimbarea fazei active se face prin DB via confirmPhaseInDB
    // Pentru navigare back la etapă confirmată: folosim state local în BOMPhaseWizard (activePhaseLocal)
  }, [completedPhases, activePhase]);

  return {
    PHASE_CONFIG,
    activePhase,
    completedPhases: completedPhases as BomPhaseKey[],
    phaseItems,
    totalByPhase,
    grandTotal,
    allPhasesConfirmed,
    confirmCurrentPhase: confirmPhaseInDB,
    goToPhase,
  };
}
