// frontend/src/pages/dashboard/ProjectBOM.tsx
//
// Pagina Devizului (Faza 3).
// Mod implicit: Wizard etapă-cu-etapă.
// Toggle în header: Wizard | Tabel Complet.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Bot, LayoutList, Wand2 } from 'lucide-react';
import { useBOMData } from '../../hooks/useBOMData';
import { BOMSummary } from '../../components/bom/BOMSummary';
import { BOMTable } from '../../components/bom/BOMTable';
import { BOMPhaseWizard } from '../../components/bom/BOMPhaseWizard';
import { BOMAdvisorChat } from '../../components/bom/BOMAdvisorChat';

type ViewMode = 'wizard' | 'table';

export const ProjectBOM = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { bomItems, isLoading, error, refetch } = useBOMData(id!);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('wizard');
  const [allConfirmed, setAllConfirmed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-buildorange border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 animate-pulse">Se calculează devizul...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-center p-8 bg-slate-50 rounded-3xl border border-slate-200 max-w-lg mx-auto">
          <p className="text-4xl mb-4">🏠</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Devizul nu poate fi generat încă</h2>
          <p className="text-sm text-slate-600 mb-6">
            Sistemul calculează cantitățile de materiale bazându-se pe dimensiunile exacte ale camerelor tale. 
            <strong> Te rugăm să te asiguri că ai salvat un plan 2D în Editor.</strong>
          </p>
          <button 
            onClick={() => navigate(`/dashboard/projects/${id}/editor`)}
            className="px-6 py-2.5 bg-buildorange text-white font-bold rounded-xl shadow-sm hover:bg-orange-600 transition-colors"
          >
            Înapoi la Editor Plan 2D
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-8"
      >
        {/* ── Header ── */}
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-6">
            <button onClick={() => navigate('/dashboard')} className="hover:text-buildorange transition-colors">Dashboard</button>
            <span>/</span>
            <button onClick={() => navigate(`/dashboard/projects/${id}`)} className="hover:text-buildorange transition-colors">Proiectul Meu</button>
            <span>/</span>
            <span className="text-slate-900">Deviz Materiale</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => navigate(`/dashboard/projects/${id}`)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Deviz Materiale</h1>
              <p className="text-sm text-slate-500 mt-1">
                Confirmat etapă-cu-etapă · Prețuri din catalogul Dedeman
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Toggle View Mode */}
              <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setViewMode('wizard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'wizard'
                      ? 'bg-white shadow-sm text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Wizard
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'table'
                      ? 'bg-white shadow-sm text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  Tabel Complet
                </button>
              </div>

              {/* AI Advisor Button */}
              <button
                onClick={() => setIsChatOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
              >
                <Bot className="w-4 h-4 text-buildorange" />
                Zidario AI
              </button>
            </div>
          </div>
        </div>

        {/* ── Conținut ── */}
        {bomItems.length === 0 ? (
          <div className="text-center p-12 bg-slate-50 rounded-3xl text-slate-500 border border-slate-100">
            <p className="text-4xl mb-4">🏗️</p>
            <p className="font-bold text-slate-700 mb-2">Devizul nu a fost generat încă</p>
            <p className="text-sm">Publică planul 2D din editorul de planuri pentru a genera devizul automat.</p>
          </div>
        ) : (
          <>
            {/* Sumar grafic — vizibil în ambele moduri */}
            <BOMSummary items={bomItems} />

            {/* Conținut principal */}
            {viewMode === 'wizard' ? (
              <BOMPhaseWizard
                projectId={id!}
                bomItems={bomItems}
                onMaterialReplaced={refetch}
                onAllConfirmed={() => setAllConfirmed(true)}
              />
            ) : (
              <BOMTable items={bomItems} onMaterialReplaced={refetch} />
            )}
          </>
        )}
      </motion.div>

      {/* AI Advisor Sidebar */}
      <BOMAdvisorChat
        projectId={id!}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </>
  );
};
