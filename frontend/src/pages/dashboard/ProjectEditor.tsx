import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditorState } from '../../hooks/useEditorState';
import { useRoomCalculator } from '../../hooks/useRoomCalculator';
import { useEditorAutoSave } from '../../hooks/useEditorAutoSave';
import { EditorCanvas } from '../../components/editor/EditorCanvas';
import { EditorToolbar } from '../../components/editor/EditorToolbar';
import { EditorRoomsPanel } from '../../components/editor/EditorRoomsPanel';
import { EditorPropertiesPanel } from '../../components/editor/EditorPropertiesPanel';
import { EditorConformityAlert } from '../../components/editor/EditorConformityAlert';
import { apiPrivate } from '../../api/axios';
import { ArrowLeft } from 'lucide-react';
import Konva from 'konva';

// Dialog simplu pentru label cameră (inline, fără librărie externă)
interface RoomLabelDialogProps {
  id: string;
  x: number;
  y: number;
  onConfirm: (id: string, label: string) => void;
  onCancel: () => void;
}

const ROOM_LABELS = [
  'Living', 'Sufragerie', 'Bucătărie', 'Dormitor 1', 'Dormitor 2', 'Dormitor 3',
  'Baie', 'Baie + WC', 'WC', 'Hol', 'Coridor', 'Debara', 'Birou', 'Scări',
];

const RoomLabelDialog: React.FC<RoomLabelDialogProps> = ({ id, onConfirm, onCancel }) => {
  const [custom, setCustom] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 space-y-4">
        <h3 className="text-lg font-black text-slate-900">Denumește Camera</h3>
        <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
          {ROOM_LABELS.map((label) => (
            <button
              key={label}
              onClick={() => onConfirm(id, label)}
              className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:border-buildorange hover:text-buildorange hover:bg-orange-50 transition-all text-left"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-buildorange"
            placeholder="Nume personalizat..."
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) onConfirm(id, custom.trim()); }}
          />
          <button
            disabled={!custom.trim()}
            onClick={() => onConfirm(id, custom.trim())}
            className="px-3 py-2 bg-buildorange text-white rounded-xl text-sm font-bold disabled:opacity-40"
          >
            OK
          </button>
        </div>
        <button
          onClick={onCancel}
          className="w-full text-xs text-slate-400 hover:text-slate-700 transition-colors"
        >
          Anulează (Esc)
        </button>
      </div>
    </div>
  );
};

// ============================================================
// Pagina principală editor
// ============================================================
export const ProjectEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = parseInt(id ?? '0');

  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectTitle, setProjectTitle] = useState('Proiect');

  // Stare dialog label
  const [labelDialog, setLabelDialog] = useState<{ id: string; x: number; y: number } | null>(null);

  const { elements, loadFromJSON, updateElement, markClean, undo, redo, deleteSelected, setTool, setZoom } = useEditorState();
  const rooms = useRoomCalculator(elements);
  const violations = rooms.filter((r) => r.conformityStatus === 'error');

  // Auto-save
  useEditorAutoSave(projectId);

  // Responsiv canvas
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleManualSave(); return; }
      if (e.ctrlKey && e.key === '0') { e.preventDefault(); setZoom(1); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return; }
      if (e.key === 'v' || e.key === 'V') { setTool('select'); return; }
      if (e.key === 'r' || e.key === 'R') { setTool('room'); return; }
      if (e.key === 'w' || e.key === 'W') { setTool('wall'); return; }
      if (e.key === 'd' || e.key === 'D') { setTool('door'); return; }
      if (e.key === 'f' || e.key === 'F') { setTool('window'); return; }
      if (e.key === 's' || e.key === 'S') { setTool('staircase'); return; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, deleteSelected, setTool, setZoom]);

  // Inițializare: load proiect + snapshot
  useEffect(() => {
    const init = async () => {
      try {
        const [{ data: project }, { data: snapshot }] = await Promise.all([
          apiPrivate.get(`/projects/${projectId}`),
          apiPrivate.get(`/editor/latest/${projectId}`).catch(() => ({ data: null })),
        ]);
        setProjectTitle(project.title ?? 'Proiect');
        if (snapshot?.planJSON?.elements) {
          loadFromJSON(snapshot.planJSON.elements);
        }
      } catch (err) {
        console.error('[ProjectEditor] Eroare la inițializare:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (projectId) init();
  }, [projectId, loadFromJSON]);

  // Salvare manuală
  const handleManualSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await apiPrivate.post('/editor/snapshots', {
        projectId,
        planJSON: { elements, savedAt: Date.now() },
        label: 'Salvare manuală',
      });
      markClean();
      setLastSaved(new Date());
    } catch (err) {
      console.error('[ProjectEditor] Eroare la salvare manuală:', err);
    } finally {
      setIsSaving(false);
    }
  }, [elements, isSaving, projectId, markClean]);

  // Export PNG
  const handleExportPNG = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataURL = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `plan-parter-${projectTitle}.png`;
    link.click();
  }, [projectTitle]);

  // Dialog label cameră
  const handleRoomLabelRequest = (id: string, x: number, y: number) => {
    setLabelDialog({ id, x, y });
  };

  const handleLabelConfirm = (id: string, label: string) => {
    updateElement(id, { label });
    setLabelDialog(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-buildorange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Se încarcă editorul...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* Top bar cu titlu și buton back */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 shrink-0 shadow-sm">
        <button
          onClick={() => navigate(`/dashboard/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:block">Înapoi la proiect</span>
        </button>
        <div className="w-px h-5 bg-slate-200" />
        <div>
          <h1 className="text-sm font-black text-slate-900 leading-none">{projectTitle}</h1>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Editor Plan Parter — Faza 2</p>
        </div>
      </div>

      {/* Toolbar */}
      <EditorToolbar
        onSave={handleManualSave}
        onExportPNG={handleExportPNG}
        isSaving={isSaving}
        lastSaved={lastSaved}
      />

      {/* Main layout: Panel stânga | Canvas | Panel dreapta */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel Camere (stânga) */}
        <EditorRoomsPanel rooms={rooms} />

        {/* Canvas zona */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-50">
          <EditorCanvas
            width={containerSize.width}
            height={containerSize.height}
            stageRef={stageRef}
            onRoomLabelRequest={handleRoomLabelRequest}
          />

          {/* Conformity alert — flotant deasupra canvas */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <div className="pointer-events-auto">
              <EditorConformityAlert violations={violations} />
            </div>
          </div>

          {/* Indicator scală */}
          <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm pointer-events-none">
            1 celulă = 1m real
          </div>
        </div>

        {/* Panel Proprietăți (dreapta) */}
        <EditorPropertiesPanel onRenameRequest={(id) => setLabelDialog({ id, x: 0, y: 0 })} />
      </div>

      {/* Dialog label cameră */}
      {labelDialog && (
        <RoomLabelDialog
          id={labelDialog.id}
          x={labelDialog.x}
          y={labelDialog.y}
          onConfirm={handleLabelConfirm}
          onCancel={() => setLabelDialog(null)}
        />
      )}
    </div>
  );
};
