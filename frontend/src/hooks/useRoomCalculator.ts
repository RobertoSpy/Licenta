import { useMemo } from 'react';
import { type CanvasElement, pxToMeters, metersToPx } from './useEditorState';

export interface RoomInfo {
  id: string;
  label: string;
  roomType?: string;
  totalSqm: number;
  usableSqm: number;
  widthM: number;
  heightM: number;
}

export function useRoomCalculator(elements: CanvasElement[]): RoomInfo[] {
  return useMemo(() => {
    const rooms = elements.filter((el) => el.type === 'room');

    return rooms.map((room) => {
      // Bounding box-urile generate de backend exclud pereții exteriori.
      // Ele împart centrul pereților interiori (15cm grosime standard).
      // Astfel, o cameră pierde în medie 7.5cm pe fiecare latură interioară.
      // Pentru simplificare, scădem 15cm per dimensiune (2 * 7.5cm).
      const interiorWallLossPx = metersToPx(0.15);
      const usableWidthPx = Math.max(0, room.width - interiorWallLossPx);
      const usableHeightPx = Math.max(0, room.height - interiorWallLossPx);

      const usableWidthM = pxToMeters(usableWidthPx);
      const usableHeightM = pxToMeters(usableHeightPx);
      const usableSqm = parseFloat((usableWidthM * usableHeightM).toFixed(2));
      const totalSqm = parseFloat((pxToMeters(room.width) * pxToMeters(room.height)).toFixed(2));

      return {
        id: room.id,
        label: room.label ?? 'Cameră',
        roomType: (room.metadata?.roomType as string) ?? undefined,
        totalSqm,
        usableSqm,
        widthM: parseFloat(pxToMeters(room.width).toFixed(2)),
        heightM: parseFloat(pxToMeters(room.height).toFixed(2)),
      };
    });
  }, [elements]);
}
