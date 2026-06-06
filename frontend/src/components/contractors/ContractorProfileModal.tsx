import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, MapPin, Building2, ShieldCheck, Mail, Calendar, CheckCircle2 } from 'lucide-react';
import { contractorApi, type ContractorProfile } from '../../api/contractorApi';

interface ContractorProfileModalProps {
  contractorId: number | null;
  onClose: () => void;
}

export const ContractorProfileModal: React.FC<ContractorProfileModalProps> = ({ contractorId, onClose }) => {
  const [profile, setProfile] = useState<ContractorProfile & { reviews?: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contractorId) return;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await contractorApi.getContractorById(contractorId);
        setProfile(data);
      } catch (error) {
        console.error("Eroare la încărcarea profilului", error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [contractorId]);

  if (!contractorId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-8 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full transition-colors text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>

            {loading ? (
              <div className="animate-pulse flex gap-6">
                <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                <div className="space-y-3 flex-1 pt-2">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                </div>
              </div>
            ) : profile ? (
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    {profile.companyName}
                    {profile.isVerified && (
                      <span title="Constructor Verificat" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 p-1 rounded-full">
                        <ShieldCheck className="w-6 h-6" />
                      </span>
                    )}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-slate-600 dark:text-slate-400 text-sm font-medium">
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {profile.county} ({profile.coverageRadius} km)</span>
                    <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-500 fill-current" /> {profile.avgRating.toFixed(1)} Rating</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-500" /> {profile.completedProjects} Lucrări</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {profile.yearsExperience || 'N/A'} ani experiență</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500">Nu s-a găsit profilul.</div>
            )}
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
            {profile && (
              <div className="space-y-8">
                {/* Despre */}
                <section>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Despre Companie</h3>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {profile.description || 'Acest constructor nu a adăugat o descriere încă.'}
                  </p>
                </section>

                {/* Specializări */}
                <section>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Specializări</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.specializations.map((spec, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-600">
                        {spec}
                      </span>
                    ))}
                  </div>
                </section>

                {/* Contact (Doar vizualizare limitată sau cerere) */}
                <section className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest mb-4">Informații Publice</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 dark:border-blue-700">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Reprezentant</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{profile.user.name || 'Nespecificat'}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Recenzii */}
                <section>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recenzii ({profile.reviews?.length || 0})</h3>
                  {profile.reviews && profile.reviews.length > 0 ? (
                    <div className="space-y-4">
                      {profile.reviews.map((r: any) => (
                        <div key={r.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{r.reviewer.name}</span>
                            <div className="flex gap-1 text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-current' : 'text-slate-300 dark:text-slate-600'}`} />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{r.comment || 'Niciun comentariu adăugat.'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">Nu există recenzii pentru acest constructor încă.</p>
                  )}
                </section>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
