import React from 'react';
import { useEditorState } from '../../hooks/useEditorState';
import {
  Undo2, Redo2, Grid3x3, ZoomIn, ZoomOut,
  Save, Download, Brain, MousePointer
} from 'lucide-react';

interface Props {
  onSave: () => void;
  onExportPNG: () => void;
  onExportPDF?: () => void;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  isSaving: boolean;
  lastSaved: Date | null;
  /** Slot pentru EditorVersionHistory — injectat din ProjectEditor */
  versionHistory?: React.ReactNode;
  unreadCount?: number;
}

export const EditorToolbar: React.FC<Props> = ({ onSave, onExportPNG, onExportPDF, isChatOpen, onToggleChat, isSaving, lastSaved, versionHistory, unreadCount }) => {
  const {
    undo, redo, undoStack, redoStack,
    canvasScale, setZoom, showGrid, toggleGrid,
  } = useEditorState();

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    // eslint-disable-next-line react-hooks/purity
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 60) return `acum ${diff}s`;
    if (diff < 3600) return `acum ${Math.floor(diff / 60)}min`;
    return lastSaved.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 flex-wrap shadow-sm z-20 relative">
      {/* Mode Indicator */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-xl text-orange-800 text-xs font-bold shadow-sm">
        <MousePointer className="w-3.5 h-3.5 text-orange-500" />
        <span>Mod Configurator (Drag pentru swap)</span>
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

      {/* Grid toggle */}
      <div className="flex gap-1">
        <button
          onClick={toggleGrid}
          title="Ascunde/Arată Grila (G)"
          className={`p-2 rounded-lg text-xs font-bold transition-all ${showGrid ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Grid3x3 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-7 bg-slate-200" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setZoom(canvasScale / 1.2)}
          title="Micsorează (-)"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1.2)}
          className="px-2 py-1 text-xs font-bold text-slate-700 bg-slate-100 rounded-md min-w-[48px] text-center hover:bg-slate-200 transition-colors"
          title="Resetează Zoom (Ctrl+0)"
        >
          {Math.round(canvasScale * 100)}%
        </button>
        <button
          onClick={() => setZoom(canvasScale * 1.2)}
          title="Mărește (+)"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Copilot AI Button */}
      {onToggleChat && (
        <>
          <div className="w-px h-7 bg-slate-200" />
          <button
            onClick={onToggleChat}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isChatOpen
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            {unreadCount && unreadCount > 0 && !isChatOpen && (
              <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-md animate-pulse">
                {unreadCount}
              </div>
            )}
            <Brain className="w-4 h-4" />
            <span>Copilot AI</span>
          </button>
        </>
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
        className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-600 shadow-sm transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:block">PNG</span>
      </button>

      {onExportPDF && (
        <button
          onClick={onExportPDF}
          title="Export PDF Prezentare"
          className="flex items-center gap-1.5 bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-600 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:block">PDF</span>
        </button>
      )}
    </div>
  );
};
