import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiPrivate } from '../../api/axios';
import {
  MapPin, ShieldCheck, Home, CheckCircle2,
  Clock, ChevronLeft, Edit2, Trash2, AlertTriangle, Building2
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface Project {
  id: number;
  title: string;
  isCompleted: boolean;
  wizardStep: number;
  createdAt: string;
  // Screen 1
  county?: string;
  locality?: string;
  seismicZone?: string;
  frostDepthCm?: number;
  plotAreaSqm?: number;
  lat?: number;
  lng?: number;
  // Screen 2
  soilType?: string;
  slopePercent?: number;
  streetOrientation?: string;
  // Screen 3
  maxAllowedFloors?: number;
  minFoundationDepthCm?: number;
  // Screen 4
  houseStyle?: string;
  hasBasement?: boolean;
  hasGroundFloor?: boolean;
  upperFloorsCount?: number;
  hasMansard?: boolean;
  totalFloors?: number;
  planStatus?: string;
  bomGeneratedAt?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 }
  }
};

const SkeletonCard = () => (
  <div className="bg-white rounded-3xl border border-slate-100 p-8 animate-pulse">
    <div className="h-4 w-24 bg-slate-200 rounded mb-6" />
    <div className="grid grid-cols-2 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-16 bg-slate-100 rounded" />
          <div className="h-6 w-24 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  </div>
);

export const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiPrivate.get<Project>(`/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch(() => navigate('/dashboard'))
      .finally(() => setIsLoading(false));
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!confirm('Ești sigur că vrei să ștergi acest proiect? Acțiunea este ireversibilă.')) return;
    setIsDeleting(true);
    try {
      await apiPrivate.delete(`/projects/${id}`);
      navigate('/dashboard');
    } catch {
      alert('Eroarea la ștergere. Încearcă din nou.');
      setIsDeleting(false);
    }
  };

  const handleContinueWizard = () => {
    localStorage.setItem('activeProjectId', id!);
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-10 w-64 bg-slate-200 animate-pulse rounded-xl" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!project) return null;

  const stepLabels = ['Date de Bază', 'Parametrii Teren', 'Reglementări', 'Viziune Casă'];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={cardVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{project.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                project.bomGeneratedAt ? 'bg-purple-100 text-purple-700' :
                project.planStatus === 'published' ? 'bg-emerald-100 text-emerald-700' :
                project.isCompleted ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {!project.isCompleted && <><Clock className="w-3 h-3" /> Faza 1 (Pasul {project.wizardStep}/4)</>}
                {project.isCompleted && project.planStatus !== 'published' && <><CheckCircle2 className="w-3 h-3" /> Faza 2 din 4</>}
                {project.planStatus === 'published' && !project.bomGeneratedAt && <><CheckCircle2 className="w-3 h-3" /> Faza 3 din 4</>}
                {project.bomGeneratedAt && <><CheckCircle2 className="w-3 h-3" /> Faza 4 din 4</>}
              </div>
              <span className="text-sm text-slate-400">Creat {new Date(project.createdAt).toLocaleDateString('ro-RO')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!project.isCompleted && (
            <Button onClick={handleContinueWizard} className="gap-2">
              <Edit2 className="w-4 h-4" /> Continuă Configurarea
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-2 text-red-500 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Se șterge...' : 'Șterge'}
          </Button>
        </div>
      </motion.div>

      {/* Wizard Progress Bar (dacÄƒ nu e completat) */}
      {!project.isCompleted && (
        <motion.div variants={cardVariants} className="bg-white border border-slate-100 rounded-3xl p-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Progres Configurator</p>
          <div className="flex items-center gap-2">
            {stepLabels.map((label, idx) => {
              const stepNum = idx + 1;
              const isCompleted = stepNum < project.wizardStep;
              const isActive = stepNum === project.wizardStep;
              return (
                <div key={stepNum} className="flex items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    isCompleted ? 'bg-emerald-500 text-white' :
                    isActive ? 'bg-buildorange text-white ring-4 ring-buildorange/20' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                  </div>
                  <div className={`hidden sm:block text-xs font-semibold ml-2 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                    {label}
                  </div>
                  {idx < 3 && <div className={`flex-1 h-0.5 mx-3 ${isCompleted ? 'bg-emerald-300' : 'bg-slate-100'}`} />}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Locație & Teren */}
        <motion.div variants={cardVariants} className="bg-white border border-slate-100 rounded-3xl p-8 space-y-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-2xl">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="font-black text-slate-900">Locație & Teren</h2>
          </div>
          <div className="grid grid-cols-2 gap-y-5">
            <DataPoint label="Județ" value={project.county} />
            <DataPoint label="Localitate" value={project.locality} />
            <DataPoint label="Suprafață" value={project.plotAreaSqm ? `${project.plotAreaSqm.toFixed(0)} m²` : undefined} />
            <DataPoint label="Tip Sol" value={project.soilType} />
            <DataPoint label="Pantă" value={project.slopePercent !== undefined ? `${project.slopePercent}%` : undefined} />
            <DataPoint label="Orientare Stradă" value={project.streetOrientation} />
          </div>
        </motion.div>

        {/* Card: Reglementări Tehnice */}
        <motion.div variants={cardVariants} className="bg-slate-900 text-white rounded-3xl p-8 space-y-6 relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-400/10 blur-3xl rounded-full" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-2xl">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="font-black text-white">Reglementări Tehnice</h2>
          </div>
          <div className="grid grid-cols-2 gap-y-5">
            <DataPointDark label="Zonă Seismică" value={project.seismicZone} accent="amber" />
            <DataPointDark label="Adânc. Îngheț" value={project.frostDepthCm ? `${project.frostDepthCm} cm` : undefined} accent="blue" />
            <DataPointDark label="Max Etaje" value={project.maxAllowedFloors ? `P + ${project.maxAllowedFloors - 1}` : undefined} accent="amber" />
            <DataPointDark label="Min. Fundare" value={project.minFoundationDepthCm ? `-${project.minFoundationDepthCm} cm` : undefined} accent="blue" />
          </div>
        </motion.div>

        {/* Card: Configurație Casă */}
        <motion.div variants={cardVariants} className="bg-white border border-slate-100 rounded-3xl p-8 space-y-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-2xl">
              <Home className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="font-black text-slate-900">Configurație Casă</h2>
          </div>
          {project.houseStyle ? (
            <div className="grid grid-cols-2 gap-y-5">
              <DataPoint label="Stil Arhitectural" value={project.houseStyle} />
              <DataPoint label="Total Niveluri" value={project.totalFloors ? `${project.totalFloors} niveluri` : undefined} />
              <DataPoint label="Subsol" value={project.hasBasement ? '✓ Da' : '✗ Nu'} />

              <DataPoint label="Etaje Supraterane" value={project.upperFloorsCount !== undefined ? `${project.upperFloorsCount}` : undefined} />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-slate-400 bg-slate-50 rounded-2xl p-4">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Configurația casei nu a fost completată încă.</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Banner Plan 2D — Faza 2 */}
      {project.isCompleted && (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-white"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-buildorange/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl flex items-center justify-center shrink-0"
            >
              <Building2 className="w-10 h-10 text-buildorange" />
            </motion.div>

            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-buildorange/20 border border-buildorange/30 text-buildorange text-xs font-bold uppercase tracking-widest mb-3">
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-buildorange inline-block"
                />
                Faza 2
              </div>
              <h3 className="text-2xl font-black mb-2">Editor Plan 2D Interactiv</h3>
              <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
                Vei putea desena planul parterului, dimensiona camerele, valida față de <strong className="text-white">Legea 114/1996</strong> și exporta un PDF de prezentare. Salvare automată la 30 secunde.
              </p>
            </div>

            <div className="shrink-0">
              <button
                onClick={() => navigate(`/dashboard/projects/${project.id}/editor`)}
                className="flex items-center gap-2 px-6 py-3 bg-buildorange text-white rounded-2xl text-sm font-black hover:bg-orange-600 transition-all shadow-lg shadow-buildorange/30 hover:shadow-buildorange/50 hover:scale-105"
              >
                <span>Deschide Editorul 2D</span>
                <span className="text-lg">✏️</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Banner Faza 3 — BOM & Timeline (Vizibil doar dacă planul e publicat) */}
      {project.planStatus === 'published' && (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 p-10 text-white mt-6"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-400/30 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
                />
                Faza 3
              </div>
              <h3 className="text-2xl font-black mb-2">Deviz & Etape Construcție</h3>
              <p className="text-emerald-100/70 text-sm max-w-lg leading-relaxed mb-4">
                Planul tău a fost aprobat! Acum poți vedea lista completă de materiale (BOM) estimată și poți urmări vizual etapele de construcție.
              </p>
              
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <button
                  onClick={() => navigate(`/dashboard/projects/${project.id}/bom`)}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-900 rounded-2xl text-sm font-black hover:bg-emerald-50 transition-all shadow-lg hover:scale-105"
                >
                  <span>📊 Vezi Deviz (BOM)</span>
                </button>
                <button
                  onClick={() => navigate(`/dashboard/projects/${project.id}/timeline`)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-700/50 text-white border border-emerald-500/30 rounded-2xl text-sm font-black hover:bg-emerald-600/50 transition-all shadow-lg hover:scale-105"
                >
                  <span>⏱️ Etape Construcție</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

    </motion.div>
  );
};

const DataPoint = ({ label, value }: { label: string; value?: string | number }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="font-bold text-slate-900">{value ?? <span className="text-slate-300 font-normal italic">â€”</span>}</p>
  </div>
);

const DataPointDark = ({ label, value, accent }: { label: string; value?: string | number; accent: 'amber' | 'blue' }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
    <p className={`font-bold ${accent === 'amber' ? 'text-amber-400' : 'text-blue-400'}`}>
      {value ?? <span className="text-slate-600 font-normal italic">â€”</span>}
    </p>
  </div>
);
