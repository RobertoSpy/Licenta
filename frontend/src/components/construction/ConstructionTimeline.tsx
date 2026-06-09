import { CheckCircle2, Circle } from 'lucide-react';
import type { ConstructionPhase } from '../../hooks/useConstructionData';

interface ConstructionTimelineProps {
  phases: ConstructionPhase[];
  onMarkCompleted: (phaseOrder: number) => void;
}

export const ConstructionTimeline = ({ phases, onMarkCompleted }: ConstructionTimelineProps) => {
  return (
    <div className="relative pl-8 space-y-12 before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
      {phases.map((phase, index) => {
        const isFirst = index === 0;
        const previousCompleted = isFirst || phases[index - 1].isCompleted;
        const canComplete = !phase.isCompleted && previousCompleted;

        return (
          <div key={phase.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            <div className={`absolute flex items-center justify-center w-8 h-8 rounded-full left-0 md:left-1/2 -translate-x-1/2 ${phase.isCompleted ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-slate-100 border-4 border-white text-slate-400'}`}>
              {phase.isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-4 h-4" />}
            </div>

            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Etapa {phase.phaseOrder}</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                  ~{phase.durationDays} zile
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">{phase.name}</h3>
              <p className="text-sm text-slate-500 mb-6">{phase.description}</p>

              {phase.isCompleted ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4" />
                  Finalizat pe {new Date(phase.completedAt!).toLocaleDateString('ro-RO')}
                </div>
              ) : (
                <button
                  onClick={() => onMarkCompleted(phase.phaseOrder)}
                  disabled={!canComplete}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    canComplete 
                      ? 'bg-buildorange text-white hover:bg-orange-600 shadow-md shadow-buildorange/20' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Marchează ca Finalizat
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
