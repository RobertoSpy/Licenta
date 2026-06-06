import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditorState } from '../../hooks/useEditorState';
import { useRoomCalculator } from '../../hooks/useRoomCalculator';
import { useEditorAutoSave } from '../../hooks/useEditorAutoSave';
import { useConformityCheck } from '../../hooks/useConformityCheck';
import { useAutoFix } from '../../hooks/useAutoFix';
import { EditorCanvas } from '../../components/editor/EditorCanvas';
import { EditorToolbar } from '../../components/editor/EditorToolbar';
import { EditorRoomsPanel } from '../../components/editor/EditorRoomsPanel';
import { EditorPropertiesPanel } from '../../components/editor/EditorPropertiesPanel';
import { EditorConformityAlert } from '../../components/editor/EditorConformityAlert';
import { EditorVersionHistory } from '../../components/editor/EditorVersionHistory';
import { EditorChatSidebar } from '../../components/editor/EditorChatSidebar';
import { apiPrivate } from '../../api/axios';
import { editorApi, FLOOR_LABELS, type FloorKey } from '../../api/editorApi';
import { ArrowLeft, Layers, ChevronRight } from 'lucide-react';
import Konva from 'konva';
import { pxToMeters } from '../../hooks/useEditorState';

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
  const [projectData, setProjectData] = useState<Record<string, unknown>>({});
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isSwitchingFloor, setIsSwitchingFloor] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [canGoNext, setCanGoNext] = useState(false);

  // Stare dialog label
  const [labelDialog, setLabelDialog] = useState<{ id: string; x: number; y: number } | null>(null);

  const { 
    elements, updateElement, markClean, isDirty, undo, redo, deleteSelected, 
    setTool, setZoom, initializeFromProject, activeFloor, switchFloor,
    activeRooms, dimensions, houseShape, updateRoomRatio, regenerateLayout 
  } = useEditorState();
  const rooms = useRoomCalculator(elements);
  const doors = elements
    .filter((el) => el.type === 'door')
    .map((el) => ({
      id: el.id,
      widthM: pxToMeters(Math.max(el.width, el.height)),
    }));

  // Hook dedicat pentru validare conformitate (cu debounce 2s) + reguli locale geometrice
  const {
    rooms: roomsWithStatus,
    violations,
    warnings,
    violationIssues,
    warningIssues,
    isPending: isConformityPending,
  } = useConformityCheck(rooms, doors, elements, projectData?.buildingPurpose as string);

  // Auto-Fix AI
  const { applyAutoFix, previewModal, setPreviewModal } = useAutoFix({
    elements,
    activeRooms,
    violationIssues,
    warningIssues,
    dimensions,
    houseShape,
    updateElement,
    updateRoomRatio,
    regenerateLayout
  });

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

  // Inițializare: load proiect + snapshot Parter
  useEffect(() => {
    const init = async () => {
      try {
        const { data: project } = await apiPrivate.get(`/projects/${projectId}`);
        setProjectData(project);
        setProjectTitle(project.title ?? 'Proiect');

        // Îrcărcăm planul parterului din DB
        const parterElements = await editorApi.loadFloor(projectId, 'parter');
        if (parterElements && parterElements.length > 0) {
          // Am plan salvat — îll încărcăm
          switchFloor('parter', parterElements);
        } else {
          // Plan nou — generăm din datele proiectului
          initializeFromProject(project);
        }
      } catch (err) {
        console.error('[ProjectEditor] Eroare la inițializare:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (projectId) init();
  }, [projectId, switchFloor, initializeFromProject]);

  // Salvare manuala — salvează etajul curent
  const handleManualSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await editorApi.saveFloor(projectId, activeFloor, elements, 'Salvare manuală');
      markClean();
      setLastSaved(new Date());
    } catch (err) {
      console.error('[ProjectEditor] Eroare la salvare manuală:', err);
    } finally {
      setIsSaving(false);
    }
  }, [elements, isSaving, projectId, activeFloor, markClean]);

  /**
   * Switch floor:
   * 1. Salvează etajul curent dacă e modificat
   * 2. Încarcă elementele etajului nou din API
   * 3. Apelează switchFloor din store
   */
  const handleSwitchFloor = useCallback(async (newFloor: FloorKey) => {
    if (newFloor === activeFloor || isSwitchingFloor) return;
    setIsSwitchingFloor(true);
    try {
      // 1. Salvează etajul curent
      await editorApi.saveFloor(projectId, activeFloor, elements);
      markClean();

      // 2. Încarcă elementele etajului nou
      const newElements = await editorApi.loadFloor(projectId, newFloor);

      // 3. Comutăm store-ul
      switchFloor(newFloor, newElements ?? []);
      setLastSaved(new Date());
    } catch (err) {
      console.error('[ProjectEditor] Eroare la comutarea etajului:', err);
    } finally {
      setIsSwitchingFloor(false);
    }
  }, [activeFloor, elements, isSwitchingFloor, projectId, markClean, switchFloor]);

  // Export PNG — Konva nativ (zero backend)
  const handleExportPNG = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataURL = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `plan-${activeFloor}-${projectTitle}.png`;
    link.click();
  }, [projectTitle, activeFloor]);

  // Export PDF — trimitem PNG base64 la backend → Puppeteer generează PDF
  const handleExportPDF = useCallback(async () => {
    const stage = stageRef.current;
    const pngBase64 = stage
      ? stage.toDataURL({ pixelRatio: 2 }).replace('data:image/png;base64,', '')
      : null;

    try {
      const response = await apiPrivate.post(
        `/export/plan-pdf/${projectId}`,
        { planPngBase64: pngBase64 },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plan-parter-${projectTitle}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ProjectEditor] Eroare export PDF:', err);
      alert('Export PDF eșuat. Asigurați-vă că ați publicat o versiune a planului.');
    }
  }, [projectId, projectTitle]);

  // Salvează planul curent (dacă e cazul) și merge mai departe la Deviz
  const handleContinue = useCallback(async () => {
    if (!canGoNext) return;
    if (isDirty) {
      await handleManualSave();
    }
    navigate(`/dashboard/projects/${projectId}/bom`);
  }, [canGoNext, isDirty, handleManualSave, navigate, projectId]);

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
      {/* Top bar cu titlu, selector etaj și buton back */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 shrink-0 shadow-sm flex-wrap">
        <button
          onClick={() => navigate(`/dashboard/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:block">Înapoi</span>
        </button>
        <div className="w-px h-5 bg-slate-200" />
        <div>
          <h1 className="text-sm font-black text-slate-900 leading-none">{projectTitle}</h1>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Editor Plan 2D — Faza 2</p>
        </div>

        {/* Selector etaj — se afișează dacă proiectul are mai mult de un nivel */}
        {(() => {
          const pd = projectData;
          const floors: { key: FloorKey; label: string }[] = [];
          if (pd?.hasGroundFloor !== false) floors.push({ key: 'parter', label: FLOOR_LABELS.parter });
          const upper = Math.min(Number(pd?.upperFloorsCount ?? 0), 1);
          if (upper >= 1) floors.push({ key: 'etaj1', label: FLOOR_LABELS.etaj1 });
          if (floors.length <= 1) return null;
          return (
            <>
              <div className="w-px h-5 bg-slate-200" />
              <div className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                {floors.map(f => (
                  <button
                    key={f.key}
                    onClick={() => handleSwitchFloor(f.key)}
                    disabled={isSwitchingFloor}
                    title={isSwitchingFloor ? 'Se salvează...' : `Comută la ${f.label}`}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all disabled:opacity-60 ${
                      activeFloor === f.key
                        ? 'bg-buildorange text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isSwitchingFloor && activeFloor === f.key
                      ? <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : f.label
                    }
                  </button>
                ))}
              </div>
            </>
          );
        })()}

        <div className="flex-1" />

        {/* Buton Continuă — Faza 3 */}
        <button
          onClick={handleContinue}
          disabled={isSaving || !canGoNext}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
          title={canGoNext ? "Salvează planul și mergi la Devizul de Materiale (Faza 3)" : "Trebuie să răspunzi la întrebarea din chat-ul Zidario pentru a continua."}
        >
          {isSaving ? 'Se salvează...' : 'Continuă'}
          {!isSaving && <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Toolbar */}
      <EditorToolbar
        onSave={handleManualSave}
        onExportPNG={handleExportPNG}
        onExportPDF={handleExportPDF}
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isSaving={isSaving}
        lastSaved={lastSaved}
        unreadCount={unreadCount}
        versionHistory={
          <EditorVersionHistory
            projectId={projectId}
            onRestore={(snapshotId) => {
              console.log('[ProjectEditor] Restaurat snapshot:', snapshotId);
              setLastSaved(new Date());
            }}
          />
        }
      />

      {/* Main layout: Panel stânga | Canvas | Panel dreapta */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel Camere (stânga) */}
        <EditorRoomsPanel rooms={roomsWithStatus} projectId={projectId} projectData={projectData} />

        {/* Canvas zona */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-50">

          {/* Canvas Konva */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <EditorCanvas
              width={containerSize.width}
              height={containerSize.height}
              stageRef={stageRef}
              onRoomLabelRequest={handleRoomLabelRequest}
            />
          </div>

          {/* Indicator scală + status conformitate */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 pointer-events-none">
            {isConformityPending && violations.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-lg">
                Verificare...
              </div>
            )}
            {!isConformityPending && warnings.length > 0 && violations.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-lg">
                ⚠ {warnings.length} cameră aproape de limită
              </div>
            )}
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
              1 celulă = 1m real
            </div>
          </div>
        </div>

        {/* Panou conformitate — coloană dreapta, între canvas și properties */}
        <div className="flex flex-col justify-start p-2 shrink-0">
          <EditorConformityAlert
            violations={violations}
            violationIssues={violationIssues}
            warningIssues={warningIssues}
            onAutoFix={applyAutoFix}
          />
        </div>

        {/* Panou Lateral: Copilot AI */}
        <EditorChatSidebar
          projectId={projectId}
          projectData={projectData}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(false)}
          onUnreadChange={(count) => setUnreadCount(count)}
          onCanGoNextChange={(can) => setCanGoNext(can)}
        />

        {/* Panel Proprietăți (dreapta) - doar dacă nu e chat-ul deschis */}
        {!isChatOpen && <EditorPropertiesPanel onRenameRequest={(id) => setLabelDialog({ id, x: 0, y: 0 })} rooms={roomsWithStatus} />}
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

      {/* Auto-Fix Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-4 flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h3 className="font-bold">Auto-Fix AI: Redesenare Necesară</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                {previewModal.message}
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Camere Ajustate:</p>
                <ul className="space-y-1">
                  {previewModal.affectedRooms.map((room, idx) => (
                    <li key={idx} className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      {room}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 text-amber-800 text-sm">
                <span className="text-lg">⚠️</span>
                <p><strong>Atenție:</strong> Modificările tale manuale de pe plan se vor pierde la regenerare.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={previewModal.onCancel}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={previewModal.onConfirm}
                  className="px-5 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-md transition-colors"
                >
                  Confirmă Redesenare
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
