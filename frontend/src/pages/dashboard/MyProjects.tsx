import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPrivate } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import {
  Plus, Building, FileText, CheckCircle2, Clock, ArrowRight,
  Inbox, Send, AlertCircle, Building2, MapPin, Calendar, Users, XCircle, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectWizard } from '../../components/wizard/ProjectWizard';
import { useAuth } from '../../context/useAuth';
import { quoteApi, type Quote } from '../../api/quoteApi';

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
  planStatus?: string;
  bomGeneratedAt?: string;
  isPublishedForBidding?: boolean;
}

interface AcceptedProject {
  id: number;
  name: string;
  county: string | null;
  buildingPurpose: string | null;
  totalArea: number | null;
  createdAt: string;
  user: { name: string | null; email: string };
  totalAmount?: number;
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

// ========== CONTRACTOR VIEW ==========
function ContractorProjectsView() {
  const [acceptedProjects, setAcceptedProjects] = useState<AcceptedProject[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [projRes, quotesRes] = await Promise.all([
          apiPrivate.get('/contractors/me/accepted-projects'),
          quoteApi.getContractorQuotes()
        ]);
        setAcceptedProjects(projRes.data);
        setPendingQuotes(quotesRes.filter((q: Quote) => q.status === 'PENDING'));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Proiectele Mele</h1>
        <p className="text-slate-500 mt-1">Proiectele câștigate și cererile clienților care te așteaptă.</p>
      </div>

      {/* === SECTION 1: Won/Active Projects === */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Proiecte Câștigate</h2>
            <p className="text-sm text-slate-400">Proiecte pentru care oferta ta a fost acceptată de client</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-40 bg-slate-200 rounded-2xl" />)}
          </div>
        ) : acceptedProjects.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-10 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nu ai proiecte active încă. Trimite oferte pentru a câștiga proiecte.</p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {acceptedProjects.map((proj, i) => (
              <motion.div
                key={proj.id}
                variants={cardVariants}
                className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-buildorange/40 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                    CÂȘTIGAT
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 mb-1 truncate">
                  {proj.name || `Proiect #${proj.id}`}
                </h3>
                <p className="text-sm text-slate-500 mb-3">
                  Client: <span className="font-medium text-slate-700">{proj.user.name || proj.user.email}</span>
                </p>

                <div className="space-y-1.5 text-xs text-slate-500">
                  {proj.county && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-buildorange" />
                      {proj.county}
                    </div>
                  )}
                  {proj.buildingPurpose && (
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      {proj.buildingPurpose}
                      {proj.totalArea ? ` · ${proj.totalArea} m²` : ''}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(proj.createdAt).toLocaleDateString('ro-RO')}
                  </div>
                </div>

                {proj.totalAmount && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400">Valoare contractată</p>
                    <p className="text-lg font-black text-buildorange">
                      {proj.totalAmount.toLocaleString('ro-RO')} RON
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* === SECTION 2: Pending Quote Requests (from clients) === */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Cereri în Așteptare</h2>
            <p className="text-sm text-slate-400">Clienți care așteaptă oferta ta — răspunde rapid pentru a câștiga proiectul</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-20 bg-slate-200 rounded-2xl" />)}
          </div>
        ) : pendingQuotes.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-10 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              Nicio cerere nouă momentan. Du-te la{' '}
              <span className="text-buildorange font-semibold">Cereri & Oferte</span> pentru a gestiona toate lead-urile.
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {pendingQuotes.map((q) => (
              <motion.div
                key={q.id}
                variants={cardVariants}
                className="bg-white border border-amber-200 rounded-2xl p-5 flex items-center justify-between hover:border-buildorange/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Proiect #{q.projectId}
                      {q.phases && q.phases.length > 0 && <span className="text-buildorange ml-1">- {q.phases.map((p: any) => p.name).join(', ')}</span>}
                      {q.project?.user?.name && (
                        <span className="text-slate-500 font-normal"> · {q.project.user.name}</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {q.project?.county && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {q.project.county}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(q.createdAt).toLocaleDateString('ro-RO')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-700 rounded-full uppercase">
                    Ofertă așteptată
                  </span>
                  <div className="flex items-center gap-1 text-buildorange font-bold text-sm group-hover:gap-2 transition-all">
                    Răspunde <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!loading && pendingQuotes.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-center">
            Mergi la <span className="text-buildorange font-semibold">Cereri & Oferte</span> pentru a trimite ofertele tale.
          </p>
        )}
      </section>
    </div>
  );
}

// ========== CLIENT VIEW ==========
export const MyProjects = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // If contractor is somehow on the dashboard route, show contractor view
  if (user?.role === 'CONTRACTOR') {
    return <ContractorProjectsView />;
  }

  useEffect(() => {
    if (showWizard) return;

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await apiPrivate.get('/projects');
        if (!cancelled) setProjects(res.data);
      } catch (err) {
        console.error("Eroare preluare proiecte:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [showWizard]);

  const startNewProject = () => {
    localStorage.removeItem('activeProjectId');
    setShowWizard(true);
  };

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
        <Button className="gap-2 shadow-lg shadow-buildorange/20" onClick={startNewProject}>
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
          <Button className="gap-2" onClick={startNewProject}>
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
              onClick={() => {
                if (proj.isCompleted) {
                  navigate(`/dashboard/projects/${proj.id}`);
                } else {
                  localStorage.setItem('activeProjectId', proj.id.toString());
                  setShowWizard(true);
                }
              }}
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
                    proj.bomGeneratedAt ? 'bg-purple-100 text-purple-700' :
                    proj.planStatus === 'published' ? 'bg-emerald-100 text-emerald-700' :
                    proj.isCompleted ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {!proj.isCompleted && <><Clock className="w-3 h-3" /> Faza 1 Pas {proj.wizardStep} din 4</>}
                    {proj.isCompleted && proj.planStatus !== 'published' && <><CheckCircle2 className="w-3 h-3" /> Faza 2 din 4</>}
                    {proj.planStatus === 'published' && !proj.bomGeneratedAt && <><CheckCircle2 className="w-3 h-3" /> Faza 3 din 4</>}
                    {proj.bomGeneratedAt && <><CheckCircle2 className="w-3 h-3" /> Faza 4 din 4</>}
                  </div>
                </div>

                <h3 className="font-black text-slate-900 text-xl mb-1 truncate">{proj.title}</h3>

                <div className="flex items-center gap-3 text-sm text-slate-500 mb-5">
                  {proj.county && <span>{proj.county}</span>}
                  {proj.county && proj.houseStyle && <span>·</span>}
                  {proj.houseStyle && <span>{proj.houseStyle}</span>}
                  {!proj.county && !proj.houseStyle && <span>{new Date(proj.createdAt).toLocaleDateString('ro-RO')}</span>}
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs font-medium text-slate-400">
                    {new Date(proj.createdAt).toLocaleDateString('ro-RO', { day:'numeric', month:'short', year:'numeric' })}
                  </div>
                  
                  {proj.isCompleted ? (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        className="h-8 text-xs px-3 bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/projects/${proj.id}/editor`);
                        }}
                      >
                        Plan 2D
                      </Button>
                      
                      {(proj.planStatus === 'published' || proj.bomGeneratedAt) && (
                        <Button 
                          className="h-8 text-xs px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/projects/${proj.id}/bom`);
                          }}
                        >
                          Deviz (BOM)
                        </Button>
                      )}
                      
                      {proj.isPublishedForBidding && (
                        <Button 
                          className="h-8 text-xs px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 border-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/projects/${proj.id}/quotes`);
                          }}
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-1" />
                          Oferte
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-buildorange font-bold text-sm group-hover:gap-2 transition-all">
                      Continuă <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
