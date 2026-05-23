import { apiPrivate } from './axios';
import type { CanvasElement } from '../hooks/useEditorState';

export type FloorKey = 'parter' | 'etaj1' | 'etaj2' | 'mansarda';

export const FLOOR_LABELS: Record<FloorKey, string> = {
  parter:   'Parter',
  etaj1:    'Etaj 1',
  etaj2:    'Etaj 2',
  mansarda: 'Mansardă',
};

export interface GenerateLayoutPayload {
  projectId: number;
  totalFloorAreaSqm: number;
  style: string;
  bedrooms: number;
}

export const editorApi = {
  /**
   * Salvează planul unui etaj specific.
   */
  async saveFloor(projectId: number, floor: FloorKey, elements: CanvasElement[], label?: string): Promise<void> {
    await apiPrivate.post('/editor/snapshots', {
      projectId,
      floor,
      planJSON: { elements, savedAt: Date.now() },
      label,
    });
  },

  /**
   * Încarcă cel mai recent plan al unui etaj specific.
   * Returnează array-ul de elemente sau null dacă nu există.
   */
  async loadFloor(projectId: number, floor: FloorKey): Promise<CanvasElement[] | null> {
    const res = await apiPrivate.get(`/editor/latest/${projectId}`, {
      params: { floor },
    });
    return (res.data?.planJSON?.elements as CanvasElement[]) ?? null;
  },

  /**
   * Generează un plan 2D folosind algoritmi backend (Treemap + Constraint Solver).
   */
  async generateLayout(payload: GenerateLayoutPayload): Promise<CanvasElement[]> {
    const response = await apiPrivate.post('/editor/generate-layout', payload);
    return response.data.elements;
  },
};
