import { apiPrivate } from './axios';
import type { CanvasElement } from '../hooks/useEditorState';

export type FloorKey = 'parter' | 'etaj1';

export const FLOOR_LABELS: Record<FloorKey, string> = {
  parter:   'Parter',
  etaj1:    'Etaj 1',
};

export interface GenerateLayoutPayload {
  projectId: number;
  totalFloorAreaSqm: number;
  style: string;
  bedrooms: number;
}

export const editorApi = {
  async saveFloor(projectId: number, floor: FloorKey, state: any, label?: string): Promise<void> {
    await apiPrivate.post('/editor/snapshots', {
      projectId,
      floor,
      planJSON: { ...state, savedAt: Date.now() },
      label,
    });
  },

  /**
   * Încarcă cel mai recent plan al unui etaj specific.
   * Returnează starea completă sau null.
   */
  async loadFloor(projectId: number, floor: FloorKey): Promise<any | null> {
    const res = await apiPrivate.get(`/editor/latest/${projectId}`, {
      params: { floor },
    });
    return res.data?.planJSON ?? null;
  },

  /**
   * Generează un plan 2D folosind algoritmi backend (Treemap + Constraint Solver).
   */
  async generateLayout(payload: GenerateLayoutPayload): Promise<CanvasElement[]> {
    const response = await apiPrivate.post('/editor/generate-layout', payload);
    return response.data.elements;
  },

  /**
   * Regenerează layout-ul configuratorului din backend folosind datele actualizate de la utilizator.
   */
  async generateConfiguratorLayout(
    projectId: number,
    shape: 'rectangle' | 'l_shape' | 'u_shape' | 't_shape',
    dimensions: any,
    rooms: any[],
    streetOrientation: string
  ): Promise<CanvasElement[]> {
    const response = await apiPrivate.post('/editor/generate-configurator-layout', {
      projectId,
      shape,
      dimensions,
      rooms,
      streetOrientation,
    });
    return response.data.elements;
  },
};
