// frontend/src/components/bom/BOMPhaseCard.tsx
//
// Cardul principal al unei etape în wizard-ul BOM.
// Afișează lista de materiale recomandate + subtotal + buton Confirmă.

import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, ArrowRight, AlertCircle } from 'lucide-react';
import type { BOMItem } from '../../hooks/useBOMData';
import type { BomPhaseConfig } from '../../hooks/useBOMPhaseWizard';
import { MaterialSideDrawer } from './MaterialSideDrawer';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────
// FORMAT RON
// ─────────────────────────────────────────────────────────────────
const ron = (v: number) =>
  new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(v);

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────
interface BOMPhaseCardProps {
  phase: BomPhaseConfig;
  items: BOMItem[];
  projectId: string;
  isConfirmed: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onConfirm: () => void;
  onBack: () => void;
  onForward: () => void;
  onMaterialReplaced: () => void;
  isConfirming?: boolean;
  canGoNext?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
export const BOMPhaseCard = ({
  phase,
  items,
  projectId,
  isConfirmed,
  canGoBack,
  canGoForward,
  onConfirm,
  onBack,
  onForward,
  onMaterialReplaced,
  isConfirming = false,
  canGoNext = false,
}: BOMPhaseCardProps) => {
  const [selectedItem, setSelectedItem] = useState<BOMItem | null>(null);

  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const isEmpty = items.length === 0;

  return (
    <>
      <div className="flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[520px]">

        {/* ── Header etapă ── */}
        <div className={`px-7 py-5 border-b border-slate-100 ${isConfirmed ? 'bg-gradient-to-r from-emerald-50 to-green-50' : 'bg-gradient-to-r from-slate-50 to-white'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{phase.icon}</span>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  {phase.labelRo.split('—')[0].trim()}
                </p>
                <h2 className="text-xl font-black text-slate-900">
                  {phase.labelRo.split('—')[1]?.trim() ?? phase.label}
                </h2>
              </div>
            </div>

            {isConfirmed && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-bold">Confirmată</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Lista materiale ── */}
        <div className="flex-1 p-7">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-4">
              <AlertCircle className="w-10 h-10 text-slate-300" />
              <p className="text-slate-500 text-sm max-w-sm leading-relaxed">{phase.emptyNote}</p>
              {(phase.key as string) === 'instalatii' && (
                <p className="text-xs text-buildorange font-medium">
                  Poți confirma această etapă și continua cu finisajele.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                // Extragem nota tehnică vs explicația educațională
                const noteParts = item.note?.split('||EXPLAIN||') ?? [];
                const techNote = noteParts[0]?.trim() ?? '';
                const plainExplanation = noteParts[1]?.trim() ?? null;
                
                // Dacă nu avem explicație dedicată, încercăm să folosim prima frază din nota tehnică ca fallback
                const fallbackNote = techNote.split('|')[0]?.trim() ?? '';

                return (
                  <div
                    key={item.id}
                    className={`group flex flex-col gap-2 p-4 rounded-2xl border transition-all ${
                      isConfirmed
                        ? 'border-slate-100 bg-slate-50/50'
                        : 'border-slate-100 hover:border-buildorange/30 hover:bg-orange-50/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Info material */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm leading-snug">{item.material.name}</p>
                        
                        {plainExplanation ? (
                          <div className="mt-1.5 flex items-start gap-1.5 text-slate-600 bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                            <span className="text-[13px]">💡</span>
                            <p className="text-[13px] leading-relaxed italic">{plainExplanation}</p>
                          </div>
                        ) : fallbackNote ? (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{fallbackNote}</p>
                        ) : null}

                        {/* Calcul vizual */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {item.quantity} {item.material.unit}
                          </span>
                          <span className="text-slate-300 text-xs">×</span>
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {ron(item.unitPrice)}/{item.material.unit}
                          </span>
                          <span className="text-slate-300 text-xs">=</span>
                          <span className="text-xs font-bold text-slate-800 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
                            {ron(item.totalPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Buton Schimbă — vizibil doar dacă nu e confirmată */}
                      {!isConfirmed && (
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-xs font-bold text-buildorange bg-orange-50 px-3 py-2 rounded-xl border border-orange-100 hover:bg-orange-100 flex items-center justify-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0"
                        >
                          🔄 Schimbă
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer: Subtotal + Navigare ── */}
        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between">
            {/* Subtotal */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subtotal etapă</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{ron(subtotal)}</p>
            </div>

            {/* Butoane navigare */}
            <div className="flex items-center gap-3">
              {canGoBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:border-slate-300 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Înapoi
                </button>
              )}

              {isConfirmed ? (
                /* Dacă etapa e deja confirmată — mergi la următoarea */
                canGoForward ? (
                  <button
                    onClick={onForward}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all"
                  >
                    Etapa Următoare
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      Deviz Finalizat
                    </div>
                    <Link
                      to="/dashboard/contractors"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-sm shadow-blue-200"
                    >
                      Caută Constructori
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )
              ) : (
                /* Etapa neconfirmată — buton Confirmă */
                <button
                  onClick={() => {
                    if (!canGoNext) {
                      window.dispatchEvent(new Event('zidario-open'));
                    } else {
                      onConfirm();
                    }
                  }}
                  disabled={isConfirming}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 shadow-sm ${
                    !canGoNext 
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 animate-pulse'
                      : 'bg-buildorange hover:bg-orange-500 shadow-orange-200'
                  }`}
                >
                  {isConfirming ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Se confirmă...
                    </>
                  ) : !canGoNext ? (
                    <>
                      🤖 Discută cu Zidario pt. Aprobare
                    </>
                  ) : (
                    <>
                      Confirmă Etapa
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drawer alternativ material */}
      <MaterialSideDrawer
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        currentItem={selectedItem}
        projectId={projectId}
        onMaterialReplaced={() => {
          setSelectedItem(null);
          onMaterialReplaced();
        }}
      />
    </>
  );
};
