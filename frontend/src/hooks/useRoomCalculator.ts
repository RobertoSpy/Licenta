import { useMemo } from 'react';
import { CanvasElement, pxToMeters, metersToPx } from './useEditorState';

// ============================================================
// Suprafețe minime legale — Legea 114/1996, Art. 5
// ============================================================
export const MINIMUM_SURFACES: Record<string, { min: number; label: string }> = {
  living:      { min: 18,  label: 'Sufragerie / Living' },
  sufragerie:  { min: 18,  label: 'Sufragerie / Living' },
  salon:       { min: 18,  label: 'Salon' },
  dormitor1:   { min: 12,  label: 'Dormitor principal' },
  dormitor:    { min: 9,   label: 'Dormitor' },
  camera:      { min: 9,   label: 'Cameră' },
  bucatarie:   { min: 5,   label: 'Bucătărie' },
  baie:        { min: 3,   label: 'Baie' },
  hol:         { min: 4,   label: 'Hol / Coridor' },
  debara:      { min: 1.5, label: 'Debara' },
};

export interface RoomInfo {
  id: string;
  label: string;
  totalSqm: number;
  usableSqm: number;
  widthM: number;
  heightM: number;
  conformityStatus: 'ok' | 'warning' | 'error';
  minRequiredSqm?: number;
}

/**
 * Normalizează label-ul camerei pentru lookup în MINIMUM_SURFACES.
 * "Dormitor 1" → "dormitor1" | "Living Room" → "living"
 */
export function normalizeLabel(label?: string): string {
  if (!label) return '';
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // elimina diacritice
    .replace(/\s+/g, '')             // elimina spatii
    .replace(/[^a-z0-9]/g, '');      // păstrează doar alfanumerice
}

export function useRoomCalculator(elements: CanvasElement[]): RoomInfo[] {
  return useMemo(() => {
    const rooms = elements.filter((el) => el.type === 'room');

    return rooms.map((room) => {
      const wallThicknessPx = metersToPx((room.wallThicknessCm ?? 25) / 100);
      const usableWidthPx = Math.max(0, room.width - 2 * wallThicknessPx);
      const usableHeightPx = Math.max(0, room.height - 2 * wallThicknessPx);

      const usableWidthM = pxToMeters(usableWidthPx);
      const usableHeightM = pxToMeters(usableHeightPx);
      const usableSqm = parseFloat((usableWidthM * usableHeightM).toFixed(2));
      const totalSqm = parseFloat((pxToMeters(room.width) * pxToMeters(room.height)).toFixed(2));

      const key = normalizeLabel(room.label);
      const minRequired = MINIMUM_SURFACES[key]?.min;

      const conformityStatus: RoomInfo['conformityStatus'] = !minRequired
        ? 'ok'
        : usableSqm >= minRequired
          ? 'ok'
          : usableSqm >= minRequired * 0.9
            ? 'warning'
            : 'error';

      return {
        id: room.id,
        label: room.label ?? 'Cameră',
        totalSqm,
        usableSqm,
        widthM: parseFloat(pxToMeters(room.width).toFixed(2)),
        heightM: parseFloat(pxToMeters(room.height).toFixed(2)),
        conformityStatus,
        minRequiredSqm: minRequired,
      };
    });
  }, [elements]);
}
