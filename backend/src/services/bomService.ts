// backend/src/services/bomService.ts
//
// BOM = Bill of Materials — calculul listei de materiale pentru fundație/structură.
//
// ARHITECTURA CORECTĂ:
//   • Deciziile deterministe (clasa betonului, adâncimea fundației) → CODUL ACESTA
//   • Explicațiile tehnice (de ce C25/30, ce înseamnă XF2) → RAG (agentul structural)
//   Cele două nu se amestecă: AI-ul nu decide clasa betonului, el explică regula.

import { prisma } from '../lib/prisma';

// ─────────────────────────────────────────────────────────────────
// TIPURI
// ─────────────────────────────────────────────────────────────────

export interface FoundationSpec {
  /** Clasa betonului + clasa de expunere (NE012-1-2022) */
  concreteClass: string;
  /** Adâncimea minimă de fundare în cm (NP112-2014) */
  minDepthCm: number;
  /** Motivul alegerii clasei de beton — injectat în prompt RAG */
  note: string;
}

// ─────────────────────────────────────────────────────────────────
// CALCULUL CLASEI DE BETON — DETERMINIST
//
// Logica: NE012-1-2022 + NP112-2014
//   frostDepthCm > 90 → zonă cu îngheț sever (ex: Harghita, Suceava, Covasna)
//                     → minim C25/30 cu expunere XF2 (cicluri îngheț-dezgheț)
//   frostDepthCm ≤ 90 → îngheț normal → C20/25 cu expunere XC2 (carbonatare în sol)
//
// Surse:
//   • NE012-1-2022 — Tab. 4.1: clase minime beton per clasă de expunere
//   • EN 206-1 (prin NE012): XC2 = beton îngropat/permanent ud, XF2 = îngheț moderat cu degivrare
// ─────────────────────────────────────────────────────────────────

export function calcFoundationSpec(
  frostDepthCm: number | null | undefined,
  soilType?: string | null
): FoundationSpec {
  const frost = frostDepthCm ?? 80; // default dacă nu e determinat încă

  // Prag conform NE012-1-2022 + hartă climatică Romania: 90cm separă zone cu
  // cicluri îngheț-dezgheț severe (Transilvania, Moldova de nord, Bucovina)
  const severeFrost = frost > 90;

  const concreteClass = severeFrost ? 'C25/30-XF2' : 'C20/25-XC2';
  const minDepthCm    = Math.max(frost + 10, 80); // 10cm sub limita de îngheț, min 80cm

  const note = severeFrost
    ? `Adâncime îngheț ${frost}cm (>90cm) → zonă cu îngheț sever → NE012-1-2022 impune minim C25/30 clasa XF2 (rezistență la cicluri îngheț-dezgheț)`
    : `Adâncime îngheț ${frost}cm → îngheț normal → NE012-1-2022 permite C20/25 clasa XC2 (beton îngropat în sol umed)`;

  return { concreteClass, minDepthCm, note };
}

// ─────────────────────────────────────────────────────────────────
// SERVICIU BOM — extindere pentru Faza 3
// ─────────────────────────────────────────────────────────────────

export const bomService = {
  /**
   * Calculează specificațiile fundației bazat pe datele de proiect.
   * Rezultatul este determinist — nu implică AI.
   * AI-ul (agentul structural) explică DE CE în RAG, pe baza chunksurilor din NE012-1-2022.
   */
  getFoundationSpec(
    frostDepthCm: number | null | undefined,
    soilType?: string | null
  ): FoundationSpec {
    return calcFoundationSpec(frostDepthCm, soilType);
  },

  /**
   * Formatează specificațiile fundației ca string pentru injectare în prompt AI.
   * Folosit în buildRAGContext ca date deterministe.
   */
  formatForPrompt(spec: FoundationSpec): string {
    return [
      `Clasa beton fundație: ${spec.concreteClass} (NE012-1-2022, Tab. 4.1)`,
      `Adâncime minimă fundare: ${spec.minDepthCm} cm (NP112-2014)`,
      `Motivare: ${spec.note}`,
    ].join('\n');
  },
};
