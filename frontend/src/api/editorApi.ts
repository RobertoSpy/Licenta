import { apiPrivate } from './axios';
import { CanvasElement } from '../hooks/useEditorState';

export interface GenerateLayoutPayload {
  projectId: number;
  totalFloorAreaSqm: number;
  style: string;
  bedrooms: number;
}

export const editorApi = {
  /**
   * Generează un plan 2D folosind algoritmi backend (Treemap + Constraint Solver)
   */
  async generateLayout(payload: GenerateLayoutPayload): Promise<CanvasElement[]> {
    const response = await apiPrivate.post('/editor/generate-layout', payload);
    return response.data.elements;
  }
};
