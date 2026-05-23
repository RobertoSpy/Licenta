import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  generateConfiguratorLayout,
  type ConfiguratorRoom,
  type ConfiguratorDimensions,
} from '../utils/layoutPartitioner';

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

export type FloorKey = 'parter' | 'etaj1' | 'etaj2' | 'mansarda';

export interface ProjectInitData {
  houseStyle?: string | null;
  streetOrientation?: string | null;
  plotAreaSqm?: number | null;
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

  // Etaj activ
  activeFloor: FloorKey;

  // Configurator state
  houseShape: 'rectangle' | 'l_shape' | 'u_shape' | 't_shape';
  dimensions: ConfiguratorDimensions;
  activeRooms: ConfiguratorRoom[];
  streetOrientation: string;
  addedOpenings: CanvasElement[];
  userDeletedOpenings: Array<{ x: number; y: number; type: string }>;

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

  // Floor actions
  /** Setează etajul activ și încarcă elementele sale. Reseteză undo/redo. */
  switchFloor: (floor: FloorKey, elements: CanvasElement[]) => void;

  // Configurator Actions
  setHouseShape: (shape: 'rectangle' | 'l_shape' | 'u_shape' | 't_shape') => void;
  setDimensions: (dims: Partial<ConfiguratorDimensions>) => void;
  toggleRoom: (label: string, checked: boolean) => void;
  updateRoomRatio: (id: string, ratioValue: number) => void;
  swapRooms: (id1: string, id2: string) => void;
  regenerateLayout: () => void;
  initializeFromProject: (project: ProjectInitData) => void;
  addManualOpening: (roomId: string, type: 'door' | 'window', side: 'top' | 'bottom' | 'left' | 'right') => void;
  /** Înlocuiește lista de camere active cu sugestia AI și regenerează layout-ul. */
  setActiveRooms: (rooms: Array<{ type: string; label: string; weightRatio: number; minSqm?: number; maxSqm?: number; mustAdjacentTo?: string[]; hasDoorTo?: string[]; isCirculation?: boolean; hasStaircase?: boolean; naturalLight?: boolean; orientation?: string[] }>) => void;
  isAiModalOpen: boolean;
  setAiModalOpen: (open: boolean) => void;
}

const MAX_UNDO = 50;

const DEFAULT_ROOMS: ConfiguratorRoom[] = [
  { id: 'r-1', label: 'Living', ratioValue: 3 },
  { id: 'r-2', label: 'Bucătărie', ratioValue: 2 },
  { id: 'r-3', label: 'Dormitor 1', ratioValue: 2 },
  { id: 'r-4', label: 'Baie', ratioValue: 1.5 },
  { id: 'r-5', label: 'Hol', ratioValue: 1.2 },
];

const INITIAL_SHAPE: 'rectangle' | 'l_shape' | 'u_shape' | 't_shape' = 'rectangle';
const INITIAL_DIMS: ConfiguratorDimensions = {
  widthM: 10,
  heightM: 8,
  wingWidthM: 4,
  wingLengthM: 4,
};

const initialElements = generateConfiguratorLayout(INITIAL_SHAPE, INITIAL_DIMS, DEFAULT_ROOMS);

export const useEditorState = create<EditorStore>((set, get) => ({
  elements: initialElements,
  selectedId: null,
  activeTool: 'select',
  canvasScale: 1.2,
  canvasOffset: { x: 40, y: 40 },
  gridSize: GRID_SIZE_PX,
  isSnapEnabled: true,
  showGrid: true,
  isDirty: false,
  undoStack: [],
  redoStack: [],

  // Etaj activ — Parter by default
  activeFloor: 'parter',

  // Configurator initial state
  houseShape: INITIAL_SHAPE,
  dimensions: INITIAL_DIMS,
  activeRooms: DEFAULT_ROOMS,
  streetOrientation: 'S',
  addedOpenings: [],
  userDeletedOpenings: [],
  isAiModalOpen: false,

  pushToUndo: () => {
    const { elements, undoStack } = get();
    const snapshot: EditorSnapshot = { elements: JSON.parse(JSON.stringify(elements)), timestamp: Date.now() };
    const newStack = [...undoStack, snapshot].slice(-MAX_UNDO);
    set({ undoStack: newStack, redoStack: [] });
  },

  switchFloor: (floor, newElements) => {
    // Înlocuim elementele cu cele ale etajului nou.
    // Resetăm undo/redo — fiecare etaj are propria sa istorie în memorie.
    // isDirty = false — datele tocmai au fost încărcate din server.
    set({
      activeFloor: floor,
      elements: newElements,
      selectedId: null,
      undoStack: [],
      redoStack: [],
      isDirty: false,
      // Resetăm și configuratorul intern (openings, etc.) — etajul nou are propria sa stare
      addedOpenings: [],
      userDeletedOpenings: [],
    });
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
    const { elements, activeRooms, addedOpenings, userDeletedOpenings } = get();
    
    const target = elements.find(el => el.id === id);
    if (!target) return;

    let nextAdded = [...addedOpenings];
    const nextDeleted = [...userDeletedOpenings];
    let nextActiveRooms = [...activeRooms];

    if (target.type === 'room') {
      nextActiveRooms = activeRooms.filter((r) => r.id !== id);
    } else if (target.type === 'door' || target.type === 'window') {
      // Check if it was manually added
      const isAdded = addedOpenings.some(o => o.id === id);
      if (isAdded) {
        nextAdded = addedOpenings.filter(o => o.id !== id);
      } else {
        // Automatically generated opening - mark coordinate as user-deleted so it is skipped during auto-generation
        nextDeleted.push({ x: target.x, y: target.y, type: target.type });
      }
    }

    set({
      elements: elements.filter((el) => el.id !== id),
      activeRooms: nextActiveRooms,
      addedOpenings: nextAdded,
      userDeletedOpenings: nextDeleted,
      selectedId: get().selectedId === id ? null : get().selectedId,
      isDirty: true,
    });
    get().regenerateLayout();
  },

  deleteSelected: () => {
    const { selectedId, deleteElement } = get();
    if (selectedId) deleteElement(selectedId);
  },

  selectElement: (id) => set({ selectedId: id }),

  setTool: (tool) => set({ activeTool: tool, selectedId: null }),

  setZoom: (scale) => set({ canvasScale: Math.max(0.1, Math.min(scale, 5)) }),
  setOffset: (offset) => set({ canvasOffset: offset }),
  setAiModalOpen: (open) => set({ isAiModalOpen: open }),

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
    // If elements are loaded from DB, we try to extract configurator state if present in metadata, or keep default
    set({ elements, isDirty: false, undoStack: [], redoStack: [], selectedId: null });
  },

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  // Configurator actions
  setHouseShape: (houseShape) => {
    get().pushToUndo();
    set({ houseShape });
    get().regenerateLayout();
  },

  setDimensions: (dims) => {
    get().pushToUndo();
    set((state) => ({
      dimensions: { ...state.dimensions, ...dims },
    }));
    get().regenerateLayout();
  },

  toggleRoom: (label, checked) => {
    get().pushToUndo();
    const { activeRooms } = get();
    let newRooms = [...activeRooms];

    if (checked) {
      // Check if it already exists to prevent duplicate entries of unique types
      const exists = activeRooms.some((r) => r.label === label);
      if (!exists) {
        let defaultRatio = 2;
        const norm = label.toLowerCase();
        if (norm.includes('baie') || norm.includes('wc')) defaultRatio = 1;
        if (norm.includes('debara') || norm.includes('camara')) defaultRatio = 0.8;
        if (norm.includes('living') || norm.includes('sufragerie')) defaultRatio = 3;
        
        newRooms.push({
          id: `r-${Date.now()}`,
          label,
          ratioValue: defaultRatio,
        });
      }
    } else {
      newRooms = activeRooms.filter((r) => r.label !== label);
    }

    set({ activeRooms: newRooms });
    get().regenerateLayout();
  },

  updateRoomRatio: (id, ratioValue) => {
    get().pushToUndo();
    const { activeRooms } = get();
    const newRooms = activeRooms.map((r) => (r.id === id ? { ...r, ratioValue } : r));
    set({ activeRooms: newRooms });
    get().regenerateLayout();
  },

  swapRooms: (id1, id2) => {
    if (id1 === id2) return;
    get().pushToUndo();
    const { activeRooms } = get();
    const idx1 = activeRooms.findIndex((r) => r.id === id1);
    const idx2 = activeRooms.findIndex((r) => r.id === id2);

    if (idx1 !== -1 && idx2 !== -1) {
      const newRooms = [...activeRooms];
      const temp = newRooms[idx1];
      newRooms[idx1] = newRooms[idx2];
      newRooms[idx2] = temp;

      set({ activeRooms: newRooms });
      get().regenerateLayout();
    }
  },

  regenerateLayout: () => {
    const { houseShape, dimensions, activeRooms, streetOrientation, userDeletedOpenings, addedOpenings } = get();
    let elements = generateConfiguratorLayout(houseShape, dimensions, activeRooms, streetOrientation);

    // Filter out deleted openings
    elements = elements.filter(el => {
      if (el.type === 'door' || el.type === 'window') {
        const matchesDeleted = userDeletedOpenings.some(del => {
          const dist = Math.hypot(el.x - del.x, el.y - del.y);
          return dist < 10 && el.type === del.type;
        });
        return !matchesDeleted;
      }
      return true;
    });

    // Append manually added openings
    elements = [...elements, ...addedOpenings];

    set({ elements, isDirty: true });
  },

  initializeFromProject: (project: ProjectInitData) => {
    const street = project.streetOrientation || 'S';

    set({
      houseShape: 'rectangle',
      activeRooms: [],
      streetOrientation: street,
      addedOpenings: [],
      userDeletedOpenings: [],
      elements: [],
      isDirty: false,
      isAiModalOpen: true, // Auto-open AI modal
    });
  },

  addManualOpening: (roomId, type, side) => {
    const { elements, addedOpenings } = get();
    const room = elements.find(el => el.id === roomId && el.type === 'room');
    if (!room) return;

    const thickPx = 5; // 25cm
    const sizePx = type === 'window' ? 24 : 18; // 1.2m vs 90cm
    let x = 0, y = 0, w = 0, h = 0;

    if (side === 'top') {
      w = sizePx; h = thickPx;
      x = room.x + room.width / 2 - sizePx / 2;
      y = room.y - thickPx / 2;
    } else if (side === 'bottom') {
      w = sizePx; h = thickPx;
      x = room.x + room.width / 2 - sizePx / 2;
      y = room.y + room.height - thickPx / 2;
    } else if (side === 'left') {
      w = thickPx; h = sizePx;
      x = room.x - thickPx / 2;
      y = room.y + room.height / 2 - sizePx / 2;
    } else { // right
      w = thickPx; h = sizePx;
      x = room.x + room.width - thickPx / 2;
      y = room.y + room.height / 2 - sizePx / 2;
    }

    const newCenterX = Math.round(x) + w / 2;
    const newCenterY = Math.round(y) + h / 2;

    // ── Collision guard: reject if an existing opening of same type is within 20px ──
    const COLLISION_THRESHOLD_PX = 20;
    const hasTooClose = elements.some(el => {
      if (el.type !== type) return false;
      const elCenterX = el.x + el.width / 2;
      const elCenterY = el.y + el.height / 2;
      return Math.hypot(newCenterX - elCenterX, newCenterY - elCenterY) < COLLISION_THRESHOLD_PX;
    });
    if (hasTooClose) {
      console.warn('[addManualOpening] Rejected: too close to existing opening.');
      return;
    }

    // ── Count guard: max 2 doors per room ──
    if (type === 'door') {
      const existingDoors = elements.filter(el => {
        if (el.type !== 'door') return false;
        // Check if door is on the boundary of this room
        const doorCX = el.x + el.width / 2;
        const doorCY = el.y + el.height / 2;
        return (
          doorCX >= room.x - 15 && doorCX <= room.x + room.width + 15 &&
          doorCY >= room.y - 15 && doorCY <= room.y + room.height + 15
        );
      });
      if (existingDoors.length >= 2) {
        console.warn('[addManualOpening] Rejected: room already has max 2 doors.');
        return;
      }
    }

    get().pushToUndo();

    const newOpening = {
      id: `man-${Date.now()}`,
      type,
      x: Math.round(x),
      y: Math.round(y),
      width: w,
      height: h,
      rotation: 0,
      label: type === 'window' ? 'Geam Manual' : 'Ușă Manuală'
    };

    set({ addedOpenings: [...addedOpenings, newOpening] });
    get().regenerateLayout();
  },

  setActiveRooms: (rooms) => {
    get().pushToUndo();
    // Convertim SuggestedRoom[] → ConfiguratorRoom[] (adăugăm id unic)
    const newRooms: ConfiguratorRoom[] = rooms.map((r: any, i: number) => ({
      id: `ai-${Date.now()}-${i}`,
      label: r.label,
      ratioValue: r.weightRatio,
      minSqm: r.minSqm,
      maxSqm: r.maxSqm,
      mustAdjacentTo: r.mustAdjacentTo,
      hasDoorTo: r.hasDoorTo,
      isCirculation: r.isCirculation,
      hasStaircase: r.hasStaircase,
      naturalLight: r.naturalLight,
      orientation: r.orientation,
    }));
    set({ activeRooms: newRooms, addedOpenings: [], userDeletedOpenings: [] });
    get().regenerateLayout();
  },
}));

