import { useEffect, useState } from 'react';
import { HardHat, Star, MapPin, CheckCircle2, ShieldCheck, Search, Filter, XCircle, Building2, FileText, Award, Send } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { contractorApi, type ContractorProfile } from '../../api/contractorApi';
import { quoteApi } from '../../api/quoteApi';
import { apiPrivate } from '../../api/axios';
import { ContractorSpecialization, SPECIALIZATION_LABELS } from '../../types/contractor';
import { motion, AnimatePresence } from 'framer-motion';

export const Experts = () => {
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [countyFilter, setCountyFilter] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState<ContractorSpecialization | ''>('');

  // Stare pentru Modal Cerere Ofertă
  const [selectedContractor, setSelectedContractor] = useState<ContractorProfile | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedPhases, setSelectedPhases] = useState<number[]>([]);
  const [quoteMessage, setQuoteMessage] = useState('');
  const [isRequestingQuote, setIsRequestingQuote] = useState(false);
  const [fullProfile, setFullProfile] = useState<ContractorProfile & { reviews?: any[] } | null>(null);

  useEffect(() => {
    const fetchContractors = async () => {
      setLoading(true);
      try {
        const data = await contractorApi.getContractors(
          countyFilter || undefined,
          selectedSpecialization ? [selectedSpecialization] : undefined
        );
        setContractors(data);
      } catch (err) {
        console.error('Eroare la preluarea experților:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContractors();
  }, [countyFilter, selectedSpecialization]);

  // La deschiderea modalului, preluăm proiectele utilizatorului și profilul complet
  useEffect(() => {
    if (selectedContractor) {
      const fetchProjectsAndProfile = async () => {
        try {
          const res = await apiPrivate.get('/projects');
          const publishedProjects = res.data.filter((p: any) => p.isPublishedForBidding);
          setProjects(publishedProjects);

          const profileData = await contractorApi.getContractorById(selectedContractor.id);
          setFullProfile(profileData);
        } catch (error) {
          console.error("Eroare", error);
        }
      };
      fetchProjectsAndProfile();
    } else {
      setSelectedProjectId('');
      setSelectedPhases([]);
      setQuoteMessage('');
      setProjects([]);
      setFullProfile(null);
    }
  }, [selectedContractor]);

  const handleRequestQuote = async () => {
    if (!selectedProjectId || selectedPhases.length === 0) {
      alert('Vă rugăm să selectați un proiect și cel puțin o etapă.');
      return;
    }
    setIsRequestingQuote(true);
    try {
      const res = await quoteApi.requestQuotes({
        projectId: Number(selectedProjectId),
        contractorIds: [selectedContractor!.id],
        message: quoteMessage,
        phaseIds: selectedPhases,
      });
      if (res.count > 0) {
        alert('Cererea de ofertă a fost trimisă cu succes către constructor!');
        setSelectedContractor(null);
      } else {
        alert(res.message || 'Constructorul nu poate licita pentru etapele selectate (specializare diferită).');
      }
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || 'Eroare la trimiterea cererii.');
    } finally {
      setIsRequestingQuote(false);
    }
  };

  const selectedProjectObj = projects.find(p => p.id === Number(selectedProjectId));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <HardHat className="w-8 h-8 text-buildorange" />
          Experți Construcții
        </h1>
        <p className="text-slate-500 mt-1">Colaborează cu echipe de top și firme validate pentru implementarea proiectului tău.</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Județ</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Ex: Cluj, București..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-buildorange outline-none"
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Specializare</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <select
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-buildorange appearance-none outline-none"
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value as ContractorSpecialization | '')}
            >
              <option value="">Toate specializările</option>
              {Object.entries(SPECIALIZATION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-slate-200 rounded-2xl" />)}
        </div>
      ) : contractors.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Niciun expert găsit</h3>
          <p className="text-slate-500">Nu am găsit firme care să corespundă filtrelor selectate.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {contractors.map((expert) => (
            <motion.div 
              key={expert.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedContractor(expert)}
              className="bg-white border border-slate-200 p-6 rounded-2xl hover:border-buildorange/30 hover:shadow-lg transition-all flex flex-col group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-buildorange transition-colors">
                    <HardHat className="w-7 h-7 text-buildorange group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight flex items-center gap-2">
                      {expert.companyName}
                      {expert.isVerified && <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                    </h3>
                    <div className="flex items-center gap-1 mt-1 text-sm text-slate-500">
                      <MapPin className="w-4 h-4" /> {expert.county} (Rază: {expert.coverageRadius} km)
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-sm font-bold">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" /> {expert.avgRating > 0 ? expert.avgRating.toFixed(1) : 'Nou'}
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                {expert.description || 'Fără descriere.'}
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {expert.specializations.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                    {SPECIALIZATION_LABELS[tag] || tag}
                  </span>
                ))}
              </div>

              <div className="mt-auto grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">PROIECTE FINALIZATE</p>
                  <p className="font-bold text-slate-900 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {expert.completedProjects} verificate
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">EXPERIENȚĂ</p>
                  <p className="font-bold text-slate-900">
                    {expert.yearsExperience ? `${expert.yearsExperience} ani` : 'Nespecificat'}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL PROFIL CONSTRUCTOR ȘI CERERE OFERTĂ */}
      <AnimatePresence>
        {selectedContractor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => !isRequestingQuote && setSelectedContractor(null)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full z-10 max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => !isRequestingQuote && setSelectedContractor(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                disabled={isRequestingQuote}
              >
                <XCircle className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-buildorange/10 text-buildorange rounded-2xl flex items-center justify-center shrink-0">
                  <Building2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    {selectedContractor.companyName}
                    {selectedContractor.isVerified && <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                  </h2>
                  <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                    <MapPin className="w-4 h-4" /> {selectedContractor.county} (Rază: {selectedContractor.coverageRadius} km)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <div className="text-2xl font-bold text-slate-800">{selectedContractor.yearsExperience || '-'} ani</div>
                  <div className="text-xs text-slate-500 font-medium">Experiență</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <div className="text-2xl font-bold text-slate-800">{selectedContractor.completedProjects || 0}</div>
                  <div className="text-xs text-slate-500 font-medium">Proiecte</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold text-amber-500 flex items-center gap-1">
                    {selectedContractor.avgRating ? selectedContractor.avgRating.toFixed(1) : '-'} <span className="text-lg">★</span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">Rating</div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Send className="w-5 h-5 text-buildorange" />
                  Cere o Ofertă
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">1. Alege Proiectul</label>
                    <select
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-buildorange outline-none"
                      value={selectedProjectId}
                      onChange={(e) => {
                        setSelectedProjectId(e.target.value ? Number(e.target.value) : '');
                        setSelectedPhases([]);
                      }}
                    >
                      <option value="">-- Selectează un proiect --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>

                  {selectedProjectObj && selectedProjectObj.constructionPhases && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-slate-700">2. Alege Etapele (pe care le ofertează)</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-buildorange rounded border-slate-300 focus:ring-buildorange"
                            checked={selectedPhases.length > 0 && selectedProjectObj.constructionPhases.filter((p: any) => !p.contractorId).every((p: any) => selectedPhases.includes(p.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPhases(selectedProjectObj.constructionPhases.filter((p: any) => !p.contractorId).map((p: any) => p.id));
                              } else {
                                setSelectedPhases([]);
                              }
                            }}
                          />
                          <span className="text-xs font-bold text-slate-600">Construcții Generale (Bifează tot ce e disponibil)</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-white border border-slate-200 rounded-xl">
                        {selectedProjectObj.constructionPhases.map((phase: any) => {
                          const isAwarded = !!phase.contractorId;
                          return (
                          <label key={phase.id} className={`flex items-center gap-2 p-2 rounded-lg ${isAwarded ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'hover:bg-slate-50 cursor-pointer'}`}>
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 text-buildorange rounded border-slate-300 focus:ring-buildorange disabled:opacity-50"
                              checked={selectedPhases.includes(phase.id) || isAwarded}
                              disabled={isAwarded}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedPhases(prev => [...prev, phase.id]);
                                else setSelectedPhases(prev => prev.filter(id => id !== phase.id));
                              }}
                            />
                            <span className="text-sm text-slate-700">{phase.name} {isAwarded && <span className="text-xs text-emerald-600 font-bold ml-1">(Atribuită)</span>}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">3. Mesaj (Opțional)</label>
                    <textarea
                      placeholder="Ex: Mă interesează doar manopera pentru fundație..."
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-buildorange outline-none min-h-[80px]"
                      value={quoteMessage}
                      onChange={(e) => setQuoteMessage(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={handleRequestQuote}
                    disabled={isRequestingQuote || !selectedProjectId || selectedPhases.length === 0}
                    className="w-full py-3 bg-buildorange hover:bg-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isRequestingQuote ? 'Se trimite...' : 'Trimite Cererea de Ofertă'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Despre firmă
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedContractor.description || 'Nicio descriere disponibilă.'}
                  </p>
                </div>

                {/* RECENZII */}
                <div className="mt-8">
                  <h4 className="font-bold text-slate-900 mb-4 text-lg">
                    Recenzii ({fullProfile?.reviews?.length || 0})
                  </h4>
                  {fullProfile?.reviews && fullProfile.reviews.length > 0 ? (
                    <div className="space-y-4">
                      {fullProfile.reviews.map((r: any) => (
                        <div key={r.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-slate-900 text-sm">{r.reviewer.name}</span>
                            <div className="flex gap-1 text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-current' : 'text-slate-300'}`} />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-slate-600">{r.comment || 'Niciun comentariu adăugat.'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">Nu există recenzii pentru acest constructor încă.</p>
                  )}
                </div>

                {selectedContractor.certifications && selectedContractor.certifications.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Certificări
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedContractor.certifications.map((cert: string, idx: number) => (
                        <span key={idx} className="bg-purple-50 text-purple-700 text-xs font-bold px-3 py-1 rounded-full border border-purple-100">
                          {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
