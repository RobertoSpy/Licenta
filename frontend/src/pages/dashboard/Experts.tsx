import { useEffect, useState } from 'react';
import { HardHat, Star, MapPin, CheckCircle2, ShieldCheck, Search, Filter } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { contractorApi, type ContractorProfile } from '../../api/contractorApi';
import { ContractorSpecialization, SPECIALIZATION_LABELS } from '../../types/contractor';
import { motion } from 'framer-motion';

export const Experts = () => {
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [countyFilter, setCountyFilter] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState<ContractorSpecialization | ''>('');

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
              className="bg-white border border-slate-200 p-6 rounded-2xl hover:border-buildorange/30 hover:shadow-lg transition-all flex flex-col group"
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
    </div>
  );
};
