// frontend/src/components/bom/BOMPhaseWizard.tsx
//
// Container principal al wizard-ului BOM etapă-cu-etapă.
// Layout: bara de progres verticală (stânga) + BOMPhaseCard (dreapta).

import { useState, useCallback } from 'react';
import { CheckCircle2, Lock, Circle, PartyPopper, Download, Home, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api, apiPrivate } from '../../api/axios';
import type { BOMItem } from '../../hooks/useBOMData';
import { useBOMPhaseWizard, PHASE_CONFIG, type BomPhaseKey } from '../../hooks/useBOMPhaseWizard';
import { BOMPhaseCard } from './BOMPhaseCard';

// ─────────────────────────────────────────────────────────────────
// FORMAT RON compact
// ─────────────────────────────────────────────────────────────────
const ronCompact = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k RON`;
  return `${Math.round(v)} RON`;
};

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────
interface BOMPhaseWizardProps {
  projectId: string;
  bomItems: BOMItem[];
  onMaterialReplaced: () => void;
  onAllConfirmed?: () => void;
  canGoNext?: boolean;
  chatState: any;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
export const BOMPhaseWizard = ({
  projectId,
  bomItems,
  onMaterialReplaced,
  onAllConfirmed,
  canGoNext = false,
  chatState,
}: BOMPhaseWizardProps) => {
  const {
    activePhase: dbActivePhase,
    completedPhases,
    phaseItems,
    totalByPhase,
    grandTotal,
    allPhasesConfirmed,
    confirmCurrentPhase,
  } = useBOMPhaseWizard(projectId, bomItems, chatState);

  // Faza vizuală locală — poate fi diferită de cea activă din DB
  // (utilizatorul poate naviga înapoi la etape confirmate)
  const [localActivePhase, setLocalActivePhase] = useState<BomPhaseKey | null>(null);
  const navigate = useNavigate();

  const handleDownloadPDF = async () => {
    try {
      // Setăm buttonul ca loading (dacă era posibil), apoi folosim axios care atașează tokenul corect
      const response = await apiPrivate.get(`/bom/${projectId}/export-pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Deviz_Proiect_${projectId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Eroare descărcare PDF:', err);
      alert('Eroare la descărcarea PDF-ului.');
    }
  };

  const handlePublish = async () => {
    try {
      await apiPrivate.post(`/market/projects/${projectId}/publish`);
      alert('Proiect publicat cu succes! Constructorii pot acum să vadă proiectul și să trimită oferte.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Eroare la publicarea proiectului:', error);
      alert('A apărut o eroare la publicarea proiectului.');
    }
  };

  const [isConfirming, setIsConfirming] = useState(false);

  // Sincronizăm faza locală cu DB când se schimbă din exterior
  // (la prima încărcare sau după confirmare)
  const effectiveActivePhase = localActivePhase ?? dbActivePhase;
  const currentPhaseIndex = PHASE_CONFIG.findIndex(p => p.key === effectiveActivePhase);
  const currentPhaseConfig = PHASE_CONFIG[currentPhaseIndex];

  const isCurrentPhaseConfirmed = completedPhases.includes(effectiveActivePhase);
  const canGoBack = currentPhaseIndex > 0;
  const canGoForward = currentPhaseIndex < PHASE_CONFIG.length - 1;

  // ── Confirmare etapă ────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    try {
      await confirmCurrentPhase();
      // Dacă mai sunt etape, avansăm automat
      if (canGoForward) {
        const nextPhase = PHASE_CONFIG[currentPhaseIndex + 1].key;
        setLocalActivePhase(nextPhase);
        window.dispatchEvent(new CustomEvent('bom-phase-view-changed', { detail: { phase: nextPhase } }));
      } else {
        onAllConfirmed?.();
      }
    } finally {
      setIsConfirming(false);
    }
  }, [confirmCurrentPhase, canGoForward, currentPhaseIndex, onAllConfirmed]);

  const handleBack = useCallback(() => {
    if (canGoBack) {
      const prevPhase = PHASE_CONFIG[currentPhaseIndex - 1].key;
      setLocalActivePhase(prevPhase);
      window.dispatchEvent(new CustomEvent('bom-phase-view-changed', { detail: { phase: prevPhase } }));
    }
  }, [canGoBack, currentPhaseIndex]);

  const handleForward = useCallback(() => {
    if (canGoForward) {
      const nextPhase = PHASE_CONFIG[currentPhaseIndex + 1].key;
      setLocalActivePhase(nextPhase);
      window.dispatchEvent(new CustomEvent('bom-phase-view-changed', { detail: { phase: nextPhase } }));
    }
  }, [canGoForward, currentPhaseIndex]);

  const handlePhaseClick = useCallback((key: BomPhaseKey) => {
    const isAccessible = completedPhases.includes(key) || key === dbActivePhase;
    if (isAccessible) {
      setLocalActivePhase(key);
      // Notificăm chat-ul că s-a schimbat faza vizualizată
      window.dispatchEvent(new CustomEvent('bom-phase-view-changed', { detail: { phase: key } }));
    }
  }, [completedPhases, dbActivePhase]);

  // ── Banner toate etapele confirmate ────────────────────────────
  if (allPhasesConfirmed) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-8 text-white text-center shadow-lg shadow-emerald-200"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black mb-2">Deviz Finalizat! 🎉</h2>
          <p className="text-emerald-100 text-sm max-w-md mx-auto">
            Toate etapele au fost confirmate. Costul total estimat al materialelor este:
          </p>
          <p className="text-4xl font-black mt-4 mb-6">
            {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(grandTotal)}
          </p>
          <p className="text-xs text-emerald-200 mb-8">
            Prețuri estimate din catalogul Dedeman · Actualizate periodic prin scraping automatizat
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-2xl mx-auto">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-emerald-700 hover:bg-emerald-50 font-bold rounded-xl transition-all shadow-md"
            >
              <Download className="w-5 h-5" />
              Descarcă Deviz PDF
            </button>
            
            <button
              onClick={handlePublish}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-xl transition-all shadow-md shadow-slate-900/20"
            >
              <Briefcase className="w-5 h-5" />
              Publică Proiectul
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-700 text-white hover:bg-emerald-800 font-bold rounded-xl transition-all"
            >
              <Home className="w-5 h-5" />
              Acasă
            </button>
          </div>
        </motion.div>

        {/* Sumar pe etape */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PHASE_CONFIG.map(phase => (
            <div key={phase.key} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span>{phase.icon}</span>
                <span className="text-sm font-bold text-slate-700">{phase.label}</span>
              </div>
              <p className="text-lg font-black text-slate-900">{ronCompact(totalByPhase[phase.key])}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[200px_1fr] gap-6 items-start">

      {/* ── Bara de progres verticală ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sticky top-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">
          Etape Construcție
        </p>

        <div className="space-y-1">
          {PHASE_CONFIG.map((phase) => {
            const isDone      = completedPhases.includes(phase.key);
            const isActive    = phase.key === effectiveActivePhase;
            const isAccessible = isDone || phase.key === dbActivePhase;
            const isLocked    = !isAccessible;

            return (
              <button
                key={phase.key}
                onClick={() => handlePhaseClick(phase.key)}
                disabled={isLocked}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : isDone
                    ? 'hover:bg-emerald-50 text-emerald-700 cursor-pointer'
                    : isLocked
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'hover:bg-slate-50 text-slate-600 cursor-pointer'
                }`}
              >
                {/* Iconiță stare */}
                <div className="shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-300" />
                  ) : (
                    <Circle className={`w-4 h-4 ${isActive ? 'text-buildorange' : 'text-slate-300'}`} />
                  )}
                </div>

                {/* Label + cost */}
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : ''}`}>
                    {phase.label}
                  </p>
                  {totalByPhase[phase.key] > 0 && (
                    <p className={`text-[10px] font-mono ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                      {ronCompact(totalByPhase[phase.key])}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Total general */}
        <div className="mt-4 pt-4 border-t border-slate-100 px-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total General</p>
          <p className="text-base font-black text-slate-900 mt-0.5">{ronCompact(grandTotal)}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            {completedPhases.length}/{PHASE_CONFIG.length} etape confirmate
          </p>
        </div>
      </div>

      {/* ── Card etapă activă ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveActivePhase}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {currentPhaseConfig && (
            <BOMPhaseCard
              phase={currentPhaseConfig}
              items={phaseItems[effectiveActivePhase]}
              projectId={projectId}
              isConfirmed={isCurrentPhaseConfirmed}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onConfirm={handleConfirm}
              onBack={handleBack}
              onForward={handleForward}
              onMaterialReplaced={onMaterialReplaced}
              isConfirming={isConfirming}
              canGoNext={canGoNext}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <div className="hidden">
        {/* Render BOMAdvisorChat invisibly just to hook up the chat logic and screen tutor.
            Usually it's rendered by the layout, but we need it here for canGoNext.
            Actually wait, where is BOMAdvisorChat rendered in the actual app?
        */}
      </div>
    </div>
  );
};
