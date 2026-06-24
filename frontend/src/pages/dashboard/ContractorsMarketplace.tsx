import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HardHat, MapPin, Star, ShieldCheck, Search, Filter } from 'lucide-react';
import { contractorApi, type ContractorProfile } from '../../api/contractorApi';
import { quoteApi } from '../../api/quoteApi';
import { useParams, useNavigate } from 'react-router-dom';
import { ContractorSpecialization, SPECIALIZATION_LABELS } from '../../types/contractor';
import { ContractorProfileModal } from '../../components/contractors/ContractorProfileModal';
import { apiPrivate } from '../../api/axios';

export default function ContractorsMarketplace() {
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [county, setCounty] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSpec, setSelectedSpec] = useState<ContractorSpecialization | ''>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [viewProfileId, setViewProfileId] = useState<number | null>(null);

  const { id } = useParams<{ id: string }>();
  const currentProjectId = id ? Number(id) : null;
  const navigate = useNavigate();

  const [userProjects, setUserProjects] = useState<{ id: number, title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(currentProjectId);

  useEffect(() => {
    if (!currentProjectId) {
      apiPrivate.get('/projects').then(res => {
        setUserProjects(res.data);
      }).catch(console.error);
    }
  }, [currentProjectId]);

  const fetchContractors = async () => {
    setLoading(true);
    try {
      const res = await contractorApi.getContractors(
        county || undefined, 
        selectedSpec ? [selectedSpec] : undefined,
        page,
        20
      );
      if (res.data) {
        setContractors(res.data);
        setTotalPages(res.pagination?.totalPages || 1);
      } else {
        // fallback legacy if API hasn't restarted yet
        setContractors(res as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractors();
  }, [county, selectedSpec, page]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRequestQuotes = async () => {
    const projectIdToSend = currentProjectId || selectedProjectId;
    if (!projectIdToSend) {
      alert('Te rugăm să selectezi un proiect activ pentru care dorești ofertă!');
      return;
    }
    if (selectedIds.length === 0) return;

    setIsSending(true);
    try {
      await quoteApi.requestQuotes({
        projectId: projectIdToSend,
        contractorIds: selectedIds,
        message: 'Aș dori o ofertă pentru construcția mea.'
      });
      setSuccessMsg('Cererile de ofertă au fost trimise cu succes!');
      setSelectedIds([]);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error(err);
      alert('Eroare la trimiterea cererilor.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <HardHat className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Marketplace Constructori
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Găsește echipa potrivită pentru proiectul tău, verificată și evaluată de alți utilizatori.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Județ</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Ex: Cluj, București..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Specializare</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <select
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 appearance-none"
              value={selectedSpec}
              onChange={(e) => setSelectedSpec(e.target.value as ContractorSpecialization | '')}
            >
              <option value="">Toate specializările</option>
              {Object.entries(SPECIALIZATION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 gap-4">
        <span className="text-blue-800 dark:text-blue-300 font-medium">
          {selectedIds.length} constructori selectați
        </span>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {!currentProjectId && userProjects.length > 0 && (
            <select
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 w-full sm:w-auto focus:ring-2 focus:ring-blue-500"
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(Number(e.target.value) || null)}
            >
              <option value="">-- Alege un proiect --</option>
              {userProjects.map(p => (
                <option key={p.id} value={p.id}>{p.title || `Proiect #${p.id}`}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleRequestQuotes}
            disabled={selectedIds.length === 0 || isSending || (!currentProjectId && !selectedProjectId)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-sm w-full sm:w-auto whitespace-nowrap"
          >
            {isSending ? 'Se trimite...' : 'Cere Ofertă Multiplă'}
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>)}
        </div>
      ) : contractors.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Nu am găsit constructori care să corespundă filtrelor.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contractors.map((c) => (
            <motion.div
              key={c.id}
              whileHover={{ y: -4 }}
              className={`bg-white dark:bg-slate-800 rounded-2xl border-2 transition-colors cursor-pointer overflow-hidden ${
                selectedIds.includes(c.id) 
                  ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
              onClick={() => toggleSelection(c.id)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {c.companyName}
                      {c.isVerified && <ShieldCheck className="h-5 w-5 text-emerald-500" />}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4" /> {c.county} (Rază: {c.coverageRadius} km)
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="h-5 w-5 fill-current" />
                      <span>{c.avgRating > 0 ? c.avgRating.toFixed(1) : 'Nou'}</span>
                    </div>
                    <span className="text-xs text-slate-400">{c.completedProjects} lucrări</span>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 mb-4">
                  {c.description || 'Fără descriere.'}
                </p>

                <div className="flex flex-wrap gap-2 mt-auto">
                  {c.specializations.map(spec => (
                    <span key={spec} className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">
                      {SPECIALIZATION_LABELS[spec] || spec}
                    </span>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewProfileId(c.id); }}
                    className="text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    Vezi Profil Complet &rarr;
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Pagina {page} din {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white disabled:opacity-50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Înapoi
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white disabled:opacity-50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Înainte
            </button>
          </div>
        </div>
      )}

      {/* Modal Profil */}
      <ContractorProfileModal 
        contractorId={viewProfileId} 
        onClose={() => setViewProfileId(null)} 
      />
    </div>
  );
}
