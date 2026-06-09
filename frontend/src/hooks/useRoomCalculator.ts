import { useMemo } from 'react';
import { type CanvasElement, pxToMeters, metersToPx } from './useEditorState';

export interface RoomInfo {
  id: string;
  label: string;
  totalSqm: number;
  usableSqm: number;
  widthM: number;
  heightM: number;
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

      return {
        id: room.id,
        label: room.label ?? 'Cameră',
        totalSqm,
        usableSqm,
        widthM: parseFloat(pxToMeters(room.width).toFixed(2)),
        heightM: parseFloat(pxToMeters(room.height).toFixed(2)),
      };
    });
  }, [elements]);
}
