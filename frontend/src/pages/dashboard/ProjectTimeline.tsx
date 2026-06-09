import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useConstructionData } from '../../hooks/useConstructionData';
import { ConstructionTimeline } from '../../components/construction/ConstructionTimeline';

export const ProjectTimeline = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { phases, isLoading, error, markCompleted } = useConstructionData(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-buildorange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-12 bg-red-50 rounded-3xl text-red-600 font-bold">
        {error}
      </div>
    );
  }

  const completedCount = phases.filter(p => p.isCompleted).length;
  const progressPercent = phases.length > 0 ? (completedCount / phases.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/dashboard/projects/${id}`)}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Timeline Construcție</h1>
          <p className="text-sm text-slate-500 mt-1">Urmărește progresul șantierului pas cu pas</p>
        </div>
      </div>

      {phases.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-slate-700">Progres General</span>
            <span className="font-black text-buildorange">{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-buildorange rounded-full"
            />
          </div>
        </div>
      )}

      {phases.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-3xl text-slate-500">
          Nu s-au găsit etape pentru acest proiect.
        </div>
      ) : (
        <ConstructionTimeline phases={phases} onMarkCompleted={markCompleted} />
      )}
    </motion.div>
  );
};
