import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, FileText, Calendar, DollarSign, MessageSquare, Phone, Mail, User, Building2, MapPin, Award } from 'lucide-react';
import { apiPrivate } from '../../api/axios';
import { useParams } from 'react-router-dom';

interface MarketQuote {
  id: number;
  contractorId: number;
  projectId: number;
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING';
  totalAmount: number | null;
  executionDays: number | null;
  message: string | null;
  createdAt: string;
  contractor?: {
    companyName: string;
    description: string | null;
    yearsExperience: number | null;
    completedProjects: number;
    avgRating: number;
    certifications: string[];
    county: string;
    coverageRadius: number;
    user: {
      name: string;
      email: string;
      phone: string;
    }
  };
}

export default function MyQuotesClient() {
  const { id } = useParams<{ id: string }>();
  const currentProjectId = id ? Number(id) : null;
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState<number | null>(null);

  // Contractor Profile Modal State
  const [selectedContractor, setSelectedContractor] = useState<MarketQuote['contractor'] | null>(null);

  useEffect(() => {
    if (currentProjectId) {
      fetchQuotes();
    } else {
      setLoading(false);
    }
  }, [currentProjectId]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const { data } = await apiPrivate.get(`/market/projects/${currentProjectId}/quotes`);
      setQuotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (quoteId: number) => {
    if (!confirm('Ești sigur că vrei să accepți această ofertă? Celelalte oferte vor fi respinse automat.')) return;
    
    setIsAccepting(quoteId);
    try {
      await apiPrivate.post(`/market/quotes/${quoteId}/accept`);
      await fetchQuotes();
    } catch (err) {
      console.error(err);
      alert('Eroare la acceptarea ofertei.');
    } finally {
      setIsAccepting(null);
    }
  };

  if (!currentProjectId) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p>Te rugăm să selectezi un proiect din dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <FileText className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Ofertele Mele</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
          {[1,2].map(i => <div key={i} className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>)}
        </div>
      ) : quotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-500 dark:text-slate-400">Nu ai primit încă nicio ofertă pentru acest proiect.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {quotes.map(q => (
            <motion.div 
              key={q.id}
              className={`bg-white dark:bg-slate-800 rounded-2xl border-2 p-6 flex flex-col ${
                q.status === 'ACCEPTED' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 
                q.status === 'REJECTED' ? 'border-red-200 opacity-60' :
                'border-slate-200 dark:border-slate-700 hover:border-slate-300'
              } transition-all`}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 
                    className="text-xl font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-2 group"
                    onClick={() => setSelectedContractor(q.contractor || null)}
                  >
                    {q.contractor?.companyName || 'Constructor Necunoscut'}
                    <User className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  
                  {q.status === 'ACCEPTED' && q.contractor?.user && (
                    <div className="mt-2 text-sm text-slate-600 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-buildorange" />
                        <a href={`tel:${q.contractor.user.phone}`} className="hover:underline">{q.contractor.user.phone}</a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-buildorange" />
                        <a href={`mailto:${q.contractor.user.email}`} className="hover:underline">{q.contractor.user.email}</a>
                      </div>
                    </div>
                  )}
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold mt-3 ${
                    q.status === 'PENDING' ? 'bg-slate-100 text-slate-600' :
                    q.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                    q.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {q.status === 'SENT' ? 'Ofertă Primită' : q.status === 'PENDING' ? 'În aşteptare' : q.status}
                  </span>
                </div>
                {q.status === 'ACCEPTED' && <CheckCircle className="h-8 w-8 text-emerald-500" />}
                {q.status === 'REJECTED' && <XCircle className="h-8 w-8 text-red-400" />}
              </div>

              {q.status === 'SENT' || q.status === 'ACCEPTED' ? (
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <DollarSign className="h-5 w-5 text-slate-400" />
                    <span className="font-semibold">Preț propus:</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {q.totalAmount ? `${q.totalAmount.toLocaleString()} RON` : 'Nespecificat'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <span className="font-semibold">Durată execuție:</span>
                    <span>{q.executionDays ? `${q.executionDays} zile` : 'Nespecificat'}</span>
                  </div>
                  
                  {q.message && (
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        <MessageSquare className="h-4 w-4" />
                        Mesaj de la constructor
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                        "{q.message}"
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <span className="text-emerald-600 text-sm flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Oferta include materialele din deviz (BOM).
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <p>În așteptarea ofertei...</p>
                </div>
              )}

              {q.status === 'SENT' && (
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => handleAccept(q.id)}
                    disabled={isAccepting === q.id}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAccepting === q.id ? 'Se acceptă...' : <><CheckCircle className="w-5 h-5"/> Acceptă Oferta</>}
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL PROFIL CONSTRUCTOR */}
      <AnimatePresence>
        {selectedContractor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedContractor(null)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-lg w-full z-10"
            >
              <button 
                onClick={() => setSelectedContractor(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Building2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{selectedContractor.companyName}</h2>
                  <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                    <MapPin className="w-4 h-4" /> {selectedContractor.county} (Rază: {selectedContractor.coverageRadius} km)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-2xl font-bold text-slate-800">{selectedContractor.yearsExperience || '-'} ani</div>
                  <div className="text-xs text-slate-500 font-medium">Experiență</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-2xl font-bold text-slate-800">{selectedContractor.completedProjects || 0}</div>
                  <div className="text-xs text-slate-500 font-medium">Proiecte finalizate</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 col-span-2 flex items-center gap-3">
                  <div className="text-2xl font-bold text-amber-500 flex items-center gap-1">
                    {selectedContractor.avgRating ? selectedContractor.avgRating.toFixed(1) : '-'} <span className="text-lg">★</span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">Rating mediu (recenzii)</div>
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

                {selectedContractor.certifications && selectedContractor.certifications.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Certificări
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedContractor.certifications.map((cert, idx) => (
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
}
