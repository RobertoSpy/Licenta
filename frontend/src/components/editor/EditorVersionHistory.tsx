import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, RotateCcw, Star, ChevronDown, X, Loader2 } from 'lucide-react';
import { apiPrivate } from '../../api/axios';
import { useEditorState } from '../../hooks/useEditorState';

// ─────────────────────────────────────────────────────────────────
// TIPURI — reflectă schema Prisma PlanSnapshot
// ─────────────────────────────────────────────────────────────────

interface Snapshot {
  id: number;
  version: number;
  label: string | null;
  isPublished: boolean;
  createdAt: string;
  planJSON: {
    elements: unknown[];
    savedAt?: number;
  };
}

interface Props {
  projectId: number;
  onRestore?: (snapshotId: number) => void;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'acum câteva secunde';
  if (diffMin < 60) return `acum ${diffMin} min`;
  if (diffMin < 1440) return `acum ${Math.floor(diffMin / 60)}h`;
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export const EditorVersionHistory: React.FC<Props> = ({ projectId, onRestore }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { loadFromJSON, isDirty } = useEditorState();

  // ── Fetch snapshot list când se deschide panelul ──────────────
  useEffect(() => {
    if (!isOpen) return;
    const fetchSnapshots = async () => {
      setIsLoading(true);
      try {
        const { data } = await apiPrivate.get<Snapshot[]>(`/editor/snapshots/${projectId}`);
        setSnapshots(data);
      } catch (err) {
        console.error('[VersionHistory] Eroare la fetch snapshots:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSnapshots();
  }, [isOpen, projectId]);

  // ── Închide la click în afara panelului ───────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  // ── Restore: înlocuiește canvas-ul cu planJSON din snapshot ──
  const handleRestore = async (snap: Snapshot) => {
    if (isDirty) {
      const ok = window.confirm(
        `Ai modificări nesalvate. Restaurezi versiunea ${snap.label ?? `v${snap.version}`}?\nModificările curente vor fi pierdute.`
      );
      if (!ok) return;
    }

    setRestoringId(snap.id);
    try {
      // Fetch conținut complet (lista poate conține doar metadate)
      const { data } = await apiPrivate.get<Snapshot>(`/editor/snapshots/single/${snap.id}`);
      if (data.planJSON?.elements) {
        loadFromJSON(data.planJSON.elements as Parameters<typeof loadFromJSON>[0]);
      }
      setIsOpen(false);
      onRestore?.(snap.id);
    } catch (err) {
      console.error('[VersionHistory] Eroare la restore:', err);
    } finally {
      setRestoringId(null);
    }
  };

  // ── Publish: marchează snapshot ca versiunea oficială ────────
  const handlePublish = async (snap: Snapshot, e: React.MouseEvent) => {
    e.stopPropagation(); // nu triggera restore
    setPublishingId(snap.id);
    try {
      await apiPrivate.patch(`/editor/snapshots/${snap.id}/publish`, { projectId });
      setSnapshots((prev) =>
        prev.map((s) => ({ ...s, isPublished: s.id === snap.id }))
      );
    } catch (err) {
      console.error('[VersionHistory] Eroare la publish:', err);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div ref={panelRef} className="relative">
      {/* ── Trigger button ────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Istoricul versiunilor"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          isOpen
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <History className="w-4 h-4" />
        <span className="hidden md:block">Versiuni</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Dropdown panel ────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">Istoricul versiunilor</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Ultimele 20 snapshot-uri salvate</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lista */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Se încarcă...</span>
                </div>
              ) : snapshots.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  Nicio versiune salvată încă.
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {snapshots.map((snap) => (
                    <li key={snap.id}>
                      <button
                        onClick={() => handleRestore(snap)}
                        disabled={restoringId === snap.id}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 group"
                      >
                        {/* Version badge */}
                        <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          snap.isPublished
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {snap.isPublished ? <Star className="w-3.5 h-3.5" /> : `v${snap.version}`}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {snap.label ?? `Versiunea ${snap.version}`}
                            </span>
                            {snap.isPublished && (
                              <span className="shrink-0 text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                                PUBLICATĂ
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400">
                              {formatDate(snap.createdAt)}
                            </span>
                            <span className="text-[11px] text-slate-300">·</span>
                            <span className="text-[11px] text-slate-400">
                              {(snap.planJSON?.elements as unknown[])?.length ?? 0} elemente
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Publish */}
                          {!snap.isPublished && (
                            <button
                              onClick={(e) => handlePublish(snap, e)}
                              disabled={publishingId === snap.id}
                              title="Marchează ca versiunea oficială"
                              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                            >
                              {publishingId === snap.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Star className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                          {/* Restore */}
                          <div className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                            {restoringId === snap.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <RotateCcw className="w-3.5 h-3.5" />
                            }
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                💡 <strong>Versiunea publicată</strong> devine intrarea pentru Faza 3 (BOM &amp; deviz).
                Restaurarea înlocuiește canvas-ul curent.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
