import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Constante de scală — 1 pixel canvas = 5cm real
// 20px = 1 metru real (conform documentație)
// ============================================================
export const PIXELS_PER_METER = 20;
export const GRID_SIZE_PX = 20; // 1 celulă = 1m real

export const pxToMeters = (px: number): number => parseFloat((px / PIXELS_PER_METER).toFixed(3));
export const metersToPx = (m: number): number => Math.round(m * PIXELS_PER_METER);

export type ToolType = 'select' | 'room' | 'wall' | 'door' | 'window' | 'staircase';

export interface CanvasElement {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
  wallThicknessCm?: number; // 25cm exterior, 12.5cm interior
  metadata?: Record<string, unknown>;
}

interface EditorSnapshot {
  elements: CanvasElement[];
  timestamp: number;
}

interface EditorStore {
  // Canvas state
  elements: CanvasElement[];
  selectedId: string | null;
  activeTool: ToolType;
  canvasScale: number;
  canvasOffset: { x: number; y: number };
  gridSize: number;
  isSnapEnabled: boolean;
  showGrid: boolean;
  isDirty: boolean;

  // Undo/Redo — max 50 snapshots în memorie
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];

  // Actions
  addElement: (el: Omit<CanvasElement, 'id'>) => CanvasElement;
  updateElement: (id: string, changes: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  deleteSelected: () => void;
  selectElement: (id: string | null) => void;
  setTool: (tool: ToolType) => void;
  setZoom: (scale: number) => void;
  setOffset: (offset: { x: number; y: number }) => void;
  toggleSnap: () => void;
  toggleGrid: () => void;
  undo: () => void;
  redo: () => void;
  loadFromJSON: (elements: CanvasElement[]) => void;
  markDirty: () => void;
  markClean: () => void;
  pushToUndo: () => void;
}

const MAX_UNDO = 50;

export const useEditorState = create<EditorStore>((set, get) => ({
  elements: [],
  selectedId: null,
  activeTool: 'select',
  canvasScale: 1,
  canvasOffset: { x: 0, y: 0 },
  gridSize: GRID_SIZE_PX,
  isSnapEnabled: true,
  showGrid: true,
  isDirty: false,
  undoStack: [],
  redoStack: [],

  pushToUndo: () => {
    const { elements, undoStack } = get();
    const snapshot: EditorSnapshot = { elements: JSON.parse(JSON.stringify(elements)), timestamp: Date.now() };
    const newStack = [...undoStack, snapshot].slice(-MAX_UNDO);
    set({ undoStack: newStack, redoStack: [] });
  },

  addElement: (el) => {
    get().pushToUndo();
    const newElement: CanvasElement = { ...el, id: uuidv4() };
    set((state) => ({
      elements: [...state.elements, newElement],
      selectedId: newElement.id,
      isDirty: true,
    }));
    return newElement;
  },

  updateElement: (id, changes) => {
    get().pushToUndo();
    set((state) => ({
      elements: state.elements.map((el) => (el.id === id ? { ...el, ...changes } : el)),
      isDirty: true,
    }));
  },

  deleteElement: (id) => {
    get().pushToUndo();
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      isDirty: true,
    }));
  },

  deleteSelected: () => {
    const { selectedId, deleteElement } = get();
    if (selectedId) deleteElement(selectedId);
  },

  selectElement: (id) => set({ selectedId: id }),

  setTool: (tool) => set({ activeTool: tool, selectedId: null }),

  setZoom: (scale) => set({ canvasScale: Math.min(Math.max(scale, 0.25), 3) }),

  setOffset: (offset) => set({ canvasOffset: offset }),

  toggleSnap: () => set((state) => ({ isSnapEnabled: !state.isSnapEnabled })),

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  undo: () => {
    const { undoStack, elements, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const currentSnapshot: EditorSnapshot = { elements: JSON.parse(JSON.stringify(elements)), timestamp: Date.now() };
    set({
      elements: prev.elements,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, currentSnapshot].slice(-MAX_UNDO),
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, elements, undoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const currentSnapshot: EditorSnapshot = { elements: JSON.parse(JSON.stringify(elements)), timestamp: Date.now() };
    set({
      elements: next.elements,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, currentSnapshot].slice(-MAX_UNDO),
      isDirty: true,
    });
  },

  loadFromJSON: (elements) => {
    set({ elements, isDirty: false, undoStack: [], redoStack: [], selectedId: null });
  },

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
}));
