import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { editorApi } from '../api/editorApi';

export interface ConfiguratorRoom {
  id: string;
  label: string;
  ratioValue: number;
  minSqm?: number;
  maxSqm?: number;
  mustAdjacentTo?: string[];
  hasDoorTo?: string[];
  isCirculation?: boolean;
  hasStaircase?: boolean;
  naturalLight?: boolean;
  orientation?: string[];
  zone?: string;
}

export interface ConfiguratorDimensions {
  widthM: number;
  heightM: number;
  wingWidthM?: number;
  wingLengthM?: number;
}

export function calculateShapeArea(shape: string, dims: ConfiguratorDimensions): number {
  const w = dims.widthM;
  const h = dims.heightM;
  const ww = dims.wingWidthM ?? 4;
  const wl = dims.wingLengthM ?? 4;

  if (shape === 'rectangle') {
    return w * h;
  } else if (shape === 'l_shape') {
    const w1 = Math.min(ww, w - 2);
    const h2 = Math.min(wl, h - 2);
    return w1 * h + (w - w1) * h2;
  } else if (shape === 'u_shape') {
    const w1 = Math.min(ww, w / 2.5);
    const h2 = Math.min(wl, h - 2);
    return 2 * w1 * h + (w - 2 * w1) * h2;
  } else if (shape === 't_shape') {
    const h1 = Math.min(wl, h / 2.2);
    const w2 = Math.min(ww, w - 2);
    return w * h1 + w2 * (h - h1);
  }
  return w * h;
}

// ============================================================
// Constante de scală — 1 pixel canvas = 5cm real
// 20px = 1 metru real (conform documentație)
// ============================================================
export const PIXELS_PER_METER = 20;
export const GRID_SIZE_PX = 20; // 1 celulă = 1m real

export const pxToMeters = (px: number): number => parseFloat((px / PIXELS_PER_METER).toFixed(3));
export const metersToPx = (m: number): number => Math.round(m * PIXELS_PER_METER);

export type ToolType = 'select' | 'room' | 'wall' | 'door' | 'window' | 'staircase' | 'terasa';

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

export type FloorKey = 'parter' | 'etaj1';

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
  isLayoutPendingRegeneration: boolean;

  // Etaj activ
  activeFloor: FloorKey;
  projectId: number | null;

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
  /** Setează etajul activ și încarcă elementele și starea configuratorului. Resetează undo/redo. */
  switchFloor: (floor: FloorKey, state: any) => void;
  setProjectId: (id: number) => void;

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
  {
    id: 'r-1', label: 'Living', ratioValue: 3, zone: 'zi',
    naturalLight: true, orientation: ['S', 'SE'],
    hasDoorTo: ['Hol', 'Bucătărie'],
    isCirculation: false,
  },
  {
    id: 'r-2', label: 'Bucătărie', ratioValue: 2, zone: 'zi',
    naturalLight: true, orientation: ['E', 'N'],
    hasDoorTo: ['Hol'],
    isCirculation: false,
  },
  {
    id: 'r-3', label: 'Dormitor 1', ratioValue: 2, zone: 'noapte',
    naturalLight: true, orientation: ['S', 'E'],
    hasDoorTo: ['Hol'],
    isCirculation: false,
  },
  {
    id: 'r-4', label: 'Baie', ratioValue: 1.5, zone: 'noapte',
    naturalLight: false,
    hasDoorTo: ['Hol'],
    isCirculation: false,
  },
  {
    id: 'r-5', label: 'Hol', ratioValue: 1.2, zone: 'distributie',
    naturalLight: false,
    hasDoorTo: [],
    isCirculation: true,
  },
];

const INITIAL_SHAPE: 'rectangle' | 'l_shape' | 'u_shape' | 't_shape' = 'rectangle';
const INITIAL_DIMS: ConfiguratorDimensions = {
  widthM: 10,
  heightM: 8,
  wingWidthM: 4,
  wingLengthM: 4,
};

const initialElements: CanvasElement[] = [];

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
  isLayoutPendingRegeneration: false,
  undoStack: [],
  redoStack: [],

  // Etaj activ — Parter by default
  activeFloor: 'parter',
  projectId: null,

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

  switchFloor: (floor, state) => {
    // Verificăm dacă state este doar un array de elemente (backward compatibility)
    const elements = Array.isArray(state) ? state : (state.elements ?? []);
    
    set((prev) => ({
      activeFloor: floor,
      elements,
      dimensions: state.dimensions ?? prev.dimensions,
      houseShape: state.houseShape ?? prev.houseShape,
      activeRooms: state.activeRooms ?? prev.activeRooms,
      streetOrientation: state.streetOrientation ?? prev.streetOrientation,
      addedOpenings: state.addedOpenings ?? prev.addedOpenings,
      userDeletedOpenings: state.userDeletedOpenings ?? prev.userDeletedOpenings,
      isDirty: false,
      undoStack: [],
      redoStack: [],
    }));
  },

  setProjectId: (id) => set({ projectId: id }),

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

    // FIX: Nu mai apelăm regenerateLayout() la ștergerea unei camere.
    // Regenerarea înlocuiește TOATE elementele (pereți, uși, ferestre) cu un plan nou-gol,
    // distrugând planul generat de AI sau editat manual.
    // Utilizatorul poate apăsa manual "Regenerează" din panel dacă vrea recalcul.
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
  setHouseShape: (newShape) => {
    get().pushToUndo();
    const { houseShape: oldShape, dimensions } = get();
    
    if (oldShape !== newShape) {
      const oldArea = calculateShapeArea(oldShape, dimensions);
      const tempNewArea = calculateShapeArea(newShape, dimensions);
      
      if (tempNewArea > 0 && oldArea > 0) {
        const scale = Math.sqrt(oldArea / tempNewArea);
        
        const newDims = {
          widthM: parseFloat((dimensions.widthM * scale).toFixed(1)),
          heightM: parseFloat((dimensions.heightM * scale).toFixed(1)),
          wingWidthM: parseFloat(((dimensions.wingWidthM ?? 4) * scale).toFixed(1)),
          wingLengthM: parseFloat(((dimensions.wingLengthM ?? 4) * scale).toFixed(1))
        };
        
        set({ houseShape: newShape, dimensions: newDims });
      } else {
        set({ houseShape: newShape });
      }
    }
    
    get().regenerateLayout();
  },

  setDimensions: (dims) => {
    get().pushToUndo();
    const { dimensions: oldDims, elements } = get();
    const newDims = { ...oldDims, ...dims };
    
    // BUG 1 FIX - SCALARE PROPORȚIONALĂ ÎN LOC DE REGENERARE
    const scaleX = newDims.widthM / oldDims.widthM;
    const scaleY = newDims.heightM / oldDims.heightM;
    
    const newElements = elements.map(el => {
      const nx = el.x * scaleX;
      const ny = el.y * scaleY;
      
      if (el.type === 'room' || el.type === 'terasa') {
        return { ...el, x: nx, y: ny, width: el.width * scaleX, height: el.height * scaleY };
      } else if (el.type === 'wall') {
        const isHorizontal = el.width > el.height;
        return { 
          ...el, 
          x: nx, 
          y: ny, 
          width: isHorizontal ? el.width * scaleX : el.width, 
          height: isHorizontal ? el.height : el.height * scaleY 
        };
      } else {
        // door, window, staircase
        return { ...el, x: nx, y: ny };
      }
    });

    set({ dimensions: newDims, elements: newElements, isDirty: true });
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

    set({ activeRooms: newRooms, isLayoutPendingRegeneration: true });
  },

  updateRoomRatio: (id, ratioValue) => {
    get().pushToUndo();
    const { activeRooms } = get();
    const newRooms = activeRooms.map((r) => (r.id === id ? { ...r, ratioValue } : r));
    set({ activeRooms: newRooms, isLayoutPendingRegeneration: true });
  },

  swapRooms: (id1, id2) => {
    if (id1 === id2) return;
    get().pushToUndo();
    const { elements } = get();
    
    // BUG 2 FIX - SWAP DOAR PE COORDONATE LOCALE (FĂRĂ REGENERARE)
    const el1 = elements.find(el => el.id === id1);
    const el2 = elements.find(el => el.id === id2);
    
    if (el1 && el2 && el1.type === 'room' && el2.type === 'room') {
      const newElements = elements.map(el => {
        if (el.id === id1) {
          return { ...el, x: el2.x, y: el2.y, width: el2.width, height: el2.height };
        }
        if (el.id === id2) {
          return { ...el, x: el1.x, y: el1.y, width: el1.width, height: el1.height };
        }
        return el;
      });
      set({ elements: newElements, isDirty: true });
    }
  },

  regenerateLayout: () => {
    set({ isLayoutPendingRegeneration: true });
    
    if ((window as any).layoutDebounceTimeout) {
      clearTimeout((window as any).layoutDebounceTimeout);
    }
    
    (window as any).layoutDebounceTimeout = setTimeout(async () => {
      const { houseShape, dimensions, activeRooms, streetOrientation, userDeletedOpenings, addedOpenings, projectId } = get();
      if (!projectId) return; // Cannot generate layout without projectId
      try {
        let elements = await editorApi.generateConfiguratorLayout(projectId, houseShape, dimensions, activeRooms, streetOrientation);

        // Filter out deleted openings
        elements = elements.filter((el: CanvasElement) => {
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

        set({ elements, isDirty: true, isLayoutPendingRegeneration: false });
      } catch (err) {
        console.error('Failed to regenerate layout', err);
        set({ isLayoutPendingRegeneration: false });
      }
    }, 300);
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

    const opening: CanvasElement = {
      id: uuidv4(),
      type,
      x: newCenterX - w / 2, 
      y: newCenterY - h / 2, 
      width: w, 
      height: h, 
      rotation: 0
    };

    const newAdded = [...addedOpenings, opening];
    set({ 
      addedOpenings: newAdded,
      elements: [...elements, opening],
      isDirty: true
    });
  },

  setActiveRooms: (rooms) => {
    get().pushToUndo();
    const newRooms: ConfiguratorRoom[] = rooms.map((r: any, i: number) => ({
      id: `ai-${Date.now()}-${i}`,
      label: r.label,
      zone: r.zone ?? 'zi',
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

