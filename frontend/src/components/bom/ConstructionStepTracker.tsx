import React from 'react';

type BomPhaseKey = 'fundatie' | 'structura' | 'zidarie' | 'acoperis' | 'instalatii' | 'finisaje';

const STEPS: Array<{ key: BomPhaseKey; label: string }> = [
  { key: 'fundatie', label: 'Fundatie' },
  { key: 'structura', label: 'Structura' },
  { key: 'zidarie', label: 'Zidarie' },
  { key: 'acoperis', label: 'Acoperis' },
  { key: 'instalatii', label: 'Instalatii' },
  { key: 'finisaje', label: 'Finisaje' },
];

interface ConstructionStepTrackerProps {
  activePhase: BomPhaseKey;
  completedPhases: BomPhaseKey[];
}

export const ConstructionStepTracker = ({
  activePhase,
  completedPhases,
}: ConstructionStepTrackerProps) => {
  return (
    <div className="px-5 py-2 border-b border-slate-100 bg-slate-50/70">
      <div className="flex flex-wrap gap-2 items-center">
        {STEPS.map((step, index) => {
          const isActive = step.key === activePhase;
          const isDone = completedPhases.includes(step.key);

          return (
            <div key={step.key} className="flex items-center gap-2">
              <div
                className={
                  "h-2.5 w-2.5 rounded-full " +
                  (isDone
                    ? 'bg-emerald-500'
                    : isActive
                    ? 'bg-buildorange'
                    : 'bg-slate-300')
                }
              />
              <span
                className={
                  "text-[11px] uppercase tracking-wide " +
                  (isDone
                    ? 'text-emerald-700'
                    : isActive
                    ? 'text-buildorange font-semibold'
                    : 'text-slate-400')
                }
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className="w-4 h-px bg-slate-200" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
