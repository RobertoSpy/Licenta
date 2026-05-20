import React from 'react';
import { useEditorState, type ToolType } from '../../hooks/useEditorState';
import {
  MousePointer2, Square, Minus, DoorOpen, Maximize2,
  Undo2, Redo2, Grid3x3, Magnet, ZoomIn, ZoomOut,
  Save, Download, AlertTriangle, Wand2, Brain
} from 'lucide-react';

interface Props {
  onSave: () => void;
  onExportPNG: () => void;
  onExportPDF?: () => void;
  onGenerateLayout?: () => void;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  isSaving: boolean;
  lastSaved: Date | null;
  /** Slot pentru EditorVersionHistory — injectat din ProjectEditor */
  versionHistory?: React.ReactNode;
}

const TOOLS: { id: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: 'select',    label: 'Selectare',  icon: <MousePointer2 className="w-4 h-4" />, shortcut: 'V' },
  { id: 'room',      label: 'Cameră',     icon: <Square className="w-4 h-4" />,        shortcut: 'R' },
  { id: 'wall',      label: 'Perete',     icon: <Minus className="w-4 h-4" />,         shortcut: 'W' },
  { id: 'door',      label: 'Ușă',        icon: <DoorOpen className="w-4 h-4" />,      shortcut: 'D' },
  { id: 'window',    label: 'Fereastră',  icon: <Maximize2 className="w-4 h-4" />,     shortcut: 'F' },
  { id: 'staircase', label: 'Scări',      icon: <Grid3x3 className="w-4 h-4" />,       shortcut: 'S' },
];

export const EditorToolbar: React.FC<Props> = ({ onSave, onExportPNG, onExportPDF, onGenerateLayout, isChatOpen, onToggleChat, isSaving, lastSaved, versionHistory }) => {
  const {
    activeTool, setTool, undo, redo, undoStack, redoStack,
    canvasScale, setZoom, isSnapEnabled, toggleSnap, showGrid, toggleGrid,
  } = useEditorState();

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 60) return `acum ${diff}s`;
    if (diff < 3600) return `acum ${Math.floor(diff / 60)}min`;
    return lastSaved.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 flex-wrap shadow-sm z-20 relative">
      {/* Tool selector */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTool === tool.id
                ? 'bg-buildorange text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {tool.icon}
            <span className="hidden lg:block">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-7 bg-slate-200" />

      {/* Undo / Redo */}
      <div className="flex gap-1">
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo (Ctrl+Z)"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Redo (Ctrl+Y)"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-7 bg-slate-200" />

      {/* Grid & Snap toggles */}
      <div className="flex gap-1">
        <button
          onClick={toggleGrid}
          title="Toggle Grid (G)"
          className={`p-2 rounded-lg text-xs font-bold transition-all ${showGrid ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Grid3x3 className="w-4 h-4" />
        </button>
        <button
          onClick={toggleSnap}
          title="Toggle Snap (Shift+G)"
          className={`p-2 rounded-lg text-xs font-bold transition-all ${isSnapEnabled ? 'bg-buildorange text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Magnet className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-7 bg-slate-200" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setZoom(canvasScale / 1.2)}
          title="Zoom Out (-)"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="px-2 py-1 text-xs font-bold text-slate-700 bg-slate-100 rounded-md min-w-[48px] text-center hover:bg-slate-200 transition-colors"
          title="Reset Zoom (Ctrl+0)"
        >
          {Math.round(canvasScale * 100)}%
        </button>
        <button
          onClick={() => setZoom(canvasScale * 1.2)}
          title="Zoom In (+)"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-7 bg-slate-200" />

      {/* Auto-Generate Button */}
      {onGenerateLayout && (
        <button
          onClick={onGenerateLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all"
        >
          <Wand2 className="w-4 h-4" />
          <span className="hidden lg:block">Generează Basic</span>
        </button>
      )}

      {/* Copilot AI Button */}
      {onToggleChat && (
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            isChatOpen
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span>Copilot AI</span>
        </button>
      )}

      <div className="flex-1" />

      {/* Last saved indicator */}
      {lastSaved && (
        <span className="text-xs text-slate-400 font-medium hidden md:block">
          💾 Salvat {formatLastSaved()}
        </span>
      )}

      {/* Version History slot */}
      {versionHistory}

      <div className="w-px h-7 bg-slate-200" />

      {/* Save & Export */}
      <button
        onClick={onSave}
        disabled={isSaving}
        title="Salvează (Ctrl+S)"
        className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-60 transition-colors"
      >
        {isSaving ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        <span className="hidden sm:block">Salvează</span>
      </button>

      <button
        onClick={onExportPNG}
        title="Export PNG"
        className="flex items-center gap-1.5 bg-buildorange text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:block">PNG</span>
      </button>

      {onExportPDF && (
        <button
          onClick={onExportPDF}
          title="Export PDF Prezentare (2 pagini)"
          className="flex items-center gap-1.5 bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-600 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:block">PDF</span>
        </button>
      )}
    </div>
  );
};
