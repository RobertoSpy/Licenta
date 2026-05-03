import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPrivate } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import { Plus, Building, FileText, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProjectWizard } from '../../components/wizard/ProjectWizard';

interface Project {
  id: number;
  title: string;
  createdAt: string;
  isCompleted: boolean;
  wizardStep: number;
  county?: string;
  houseStyle?: string;
  seismicZone?: string;
  bomItems?: unknown[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 }
  }
};

const SkeletonProjectCard = () => (
  <div className="bg-white border border-slate-100 p-6 rounded-3xl animate-pulse space-y-4">
    <div className="flex items-center justify-between">
      <div className="h-10 w-10 rounded-2xl bg-slate-100" />
      <div className="h-5 w-20 rounded-full bg-slate-100" />
    </div>
    <div className="h-6 w-36 bg-slate-200 rounded-lg" />
    <div className="h-4 w-24 bg-slate-100 rounded" />
    <div className="border-t border-slate-100 pt-4 flex justify-between">
      <div className="h-4 w-20 bg-slate-100 rounded" />
      <div className="h-4 w-16 bg-slate-100 rounded" />
    </div>
  </div>
);

export const MyProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (showWizard) return;

    setIsLoading(true);
    apiPrivate.get('/projects')
      .then(res => setProjects(res.data))
      .catch(err => console.error("Eroare preluare proiecte:", err))
      .finally(() => setIsLoading(false));
  }, [showWizard]);

  if (showWizard) {
    return (
      <div className="flex items-center justify-center min-h-[85vh]">
        <ProjectWizard onCancel={() => setShowWizard(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Proiectele Mele</h1>
          <p className="text-slate-500 mt-1">Gestionează-ți construcțiile și vizionează devizele.</p>
        </div>
        <Button className="gap-2 shadow-lg shadow-buildorange/20" onClick={() => setShowWizard(true)}>
          <Plus className="w-5 h-5" /> Proiect Nou
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonProjectCard key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-white border border-slate-200 border-dashed rounded-3xl p-12 text-center flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <Building className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">Niciun proiect momentan</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6 text-sm leading-relaxed">
            Începe prin a crea un proiect nou. Modelează-ți casa în 2D și află costurile exacte cu materialele din piață.
          </p>
          <Button className="gap-2" onClick={() => setShowWizard(true)}>
            <Plus className="w-5 h-5" /> Creează primul proiect
          </Button>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {projects.map((proj) => (
            <motion.div
              key={proj.id}
              variants={cardVariants}
              whileHover={{ y: -6, scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 15 } }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/dashboard/projects/${proj.id}`)}
              className="bg-white border border-slate-200 p-6 rounded-3xl hover:border-buildorange/30 hover:shadow-xl transition-all group cursor-pointer relative overflow-hidden"
            >
              {/* Decorative background blob */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-2xl" />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-50 text-buildorange rounded-2xl flex items-center justify-center group-hover:bg-buildorange group-hover:text-white transition-all">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    proj.isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {proj.isCompleted
                      ? <><CheckCircle2 className="w-3 h-3" /> Completat</>
                      : <><Clock className="w-3 h-3" /> Pas {proj.wizardStep}/4</>
                    }
                  </div>
                </div>

                <h3 className="font-black text-slate-900 text-xl mb-1 truncate">{proj.title}</h3>

                <div className="flex items-center gap-3 text-sm text-slate-500 mb-5">
                  {proj.county && <span>{proj.county}</span>}
                  {proj.county && proj.houseStyle && <span>·</span>}
                  {proj.houseStyle && <span>{proj.houseStyle}</span>}
                  {!proj.county && !proj.houseStyle && <span>{new Date(proj.createdAt).toLocaleDateString('ro-RO')}</span>}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-400">
                    {new Date(proj.createdAt).toLocaleDateString('ro-RO', { day:'numeric', month:'short', year:'numeric' })}
                  </div>
                  <div className="flex items-center gap-1 text-buildorange font-bold text-sm group-hover:gap-2 transition-all">
                    {proj.isCompleted ? 'Detalii' : 'Continuă'} <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

