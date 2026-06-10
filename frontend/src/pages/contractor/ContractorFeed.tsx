import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, MapPin, Building2, Calendar, FileText, Send, Lock } from 'lucide-react';
import { api, apiPrivate } from '../../api/axios';
import { useOutletContext } from 'react-router-dom';

interface FeedProject {
  id: number;
  title: string;
  county: string | null;
  locality: string | null;
  buildingPurpose: string | null;
  totalFloorAreaSqm: number | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
    phone?: string;
  };
  constructionPhases?: {
    id: number;
    name: string;
    phaseOrder: number;
    contractorId: number | null;
    contractor?: { companyName: string } | null;
  }[];
  contractorQuotes?: { status: string }[];
}

export default function ContractorFeed() {
  const { isVerified } = useOutletContext<{ isVerified: boolean | null }>();
  const [projects, setProjects] = useState<FeedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<FeedProject | null>(null);

  const [totalAmount, setTotalAmount] = useState<string>('');
  const [executionDays, setExecutionDays] = useState<string>('');
  const [message, setMessage] = useState('');
  const [selectedPhases, setSelectedPhases] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const { data } = await apiPrivate.get('/market/projects/feed');
      setProjects(data.projects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    if (selectedProject.constructionPhases && selectedProject.constructionPhases.length > 0 && selectedPhases.length === 0) {
      alert('Te rugăm să selectezi cel puțin o etapă pentru care ofertezi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPrivate.post(`/market/projects/${selectedProject.id}/quotes`, {
        totalAmount: Number(totalAmount),
        executionDays: Number(executionDays),
        message,
        selectedPhases
      });
      alert('Oferta a fost trimisă cu succes!');
      setSelectedProject(null);
      setTotalAmount('');
      setExecutionDays('');
      setMessage('');
      setSelectedPhases([]);
      fetchFeed();
    } catch (err) {
      console.error(err);
      alert('Eroare la trimiterea ofertei.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Briefcase className="h-8 w-8 text-buildorange" />
        <h1 className="text-3xl font-bold text-slate-800">Proiecte Disponibile (Feed)</h1>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>)}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <p className="text-slate-500">Nu există proiecte disponibile pe piață momentan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 flex flex-col gap-4">
            {projects.map(p => (
              <div 
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedProject?.id === p.id 
                    ? 'border-buildorange bg-orange-50' 
                    : 'border-slate-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-900 truncate">{p.title || `Proiect #${p.id}`}</h4>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" />
                  {p.locality ? `${p.locality}, ` : ''}{p.county || 'Locație nespecificată'}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm font-medium mt-2">
                  Client: {p.user?.name || p.user?.email || 'Anonim'}
                </p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selectedProject ? (
                <motion.div
                  key="selected"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm"
                >
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">
                    {selectedProject.title || `Detalii Proiect #${selectedProject.id}`}
                  </h2>

                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date Generale</h4>
                      <ul className="text-sm text-slate-700 space-y-1">
                        <li><strong>Client:</strong> {selectedProject.user?.name || selectedProject.user?.email}</li>
                        {isVerified && selectedProject.user?.phone && (
                          <li><strong>Telefon:</strong> <a href={`tel:${selectedProject.user.phone}`} className="text-blue-600">{selectedProject.user.phone}</a></li>
                        )}
                        {!isVerified && (
                          <li><strong>Telefon:</strong> <span className="text-slate-400 italic">Ascuns - Necesită Validare</span></li>
                        )}
                        <li><strong>Județ:</strong> {selectedProject.county || 'Nespecificat'}</li>
                        <li><strong>Tip construcție:</strong> {selectedProject.buildingPurpose || 'Nespecificat'}</li>
                        <li><strong>Suprafață:</strong> {selectedProject.totalFloorAreaSqm ? `${selectedProject.totalFloorAreaSqm.toFixed(2)} mp` : 'Nespecificat'}</li>
                      </ul>
                      
                      {selectedProject.constructionPhases && selectedProject.constructionPhases.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Etape Licitate</h5>
                          <ul className="space-y-2">
                            {selectedProject.constructionPhases.map(phase => (
                              <li key={phase.id} className="text-sm flex justify-between items-center bg-white p-2 rounded border border-slate-100 shadow-sm">
                                <span className="font-medium text-slate-700">{phase.name}</span>
                                {phase.contractorId ? (
                                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                    Câștigat: {phase.contractor?.companyName || 'Firmă'}
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    Deschis
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                      <FileText className="w-8 h-8 text-buildorange mb-2" />
                      <p className="text-sm font-bold text-slate-700 mb-3">
                        Fișiere atașate proiectului
                      </p>
                      <div className="flex flex-col gap-2 w-full">
                        <button 
                          onClick={async () => {
                            try {
                              const res = await apiPrivate.post(`/export/plan-pdf/${selectedProject.id}`, {}, { responseType: 'blob' });
                              const url = window.URL.createObjectURL(new Blob([res.data]));
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', `Plan2D_${selectedProject.id}.pdf`);
                              document.body.appendChild(link);
                              link.click();
                            } catch (e) {
                              alert('Eroare la descărcarea planului 2D. Este posibil să nu existe.');
                            }
                          }}
                          className="w-full text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition-colors"
                        >
                          Descarcă Plan 2D (PDF)
                        </button>
                        
                        <button 
                          onClick={async () => {
                            try {
                              const res = await apiPrivate.get(`/bom/${selectedProject.id}/export-pdf`, { responseType: 'blob' });
                              const url = window.URL.createObjectURL(new Blob([res.data]));
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', `DevizBOM_${selectedProject.id}.pdf`);
                              document.body.appendChild(link);
                              link.click();
                            } catch (e) {
                              alert('Eroare la descărcarea Devizului. Este posibil să nu fie generat.');
                            }
                          }}
                          className="w-full text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg transition-colors"
                        >
                          Descarcă Deviz BOM (PDF)
                        </button>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100 mb-8" />

                  {isVerified !== false ? (
                    <form onSubmit={handleSubmitQuote} className="space-y-6">
                      <h3 className="text-xl font-bold text-slate-900 mb-4">Trimite Oferta Ta</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Preț total ofertat (RON)
                          </label>
                          <input 
                            required type="number" min={1}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-buildorange font-mono text-lg"
                            value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Durată estimată (zile)
                          </label>
                          <input 
                            required type="number" min={1}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-buildorange"
                            value={executionDays} onChange={e => setExecutionDays(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mesaj pentru client</label>
                        <textarea 
                          rows={3} 
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-buildorange"
                          placeholder="Ex: Oferim reducere de 5% la plata în avans..."
                          value={message} onChange={e => setMessage(e.target.value)}
                        />
                      </div>

                      {selectedProject.constructionPhases && selectedProject.constructionPhases.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Alege Etapele Ofertate</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedProject.constructionPhases.map(phase => {
                              const isWon = !!phase.contractorId;
                              return (
                                <div key={phase.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isWon ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-buildorange cursor-pointer'}`}>
                                  <input 
                                    type="checkbox" 
                                    id={`phase-${phase.id}`}
                                    disabled={isWon}
                                    checked={selectedPhases.includes(phase.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedPhases(prev => [...prev, phase.id]);
                                      } else {
                                        setSelectedPhases(prev => prev.filter(id => id !== phase.id));
                                      }
                                    }}
                                    className="w-5 h-5 rounded border-slate-300 text-buildorange focus:ring-buildorange disabled:opacity-50"
                                  />
                                  <label htmlFor={`phase-${phase.id}`} className={`text-sm font-medium flex-1 ${isWon ? 'text-slate-500' : 'text-slate-700 cursor-pointer'}`}>
                                    {phase.name}
                                    {isWon && <span className="block text-xs text-slate-400 font-normal">Câștigat de altă firmă</span>}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const activeQuote = selectedProject.contractorQuotes?.find(q => q.status !== 'REJECTED');
                        if (activeQuote) {
                          let statusLabel = 'Trimisă';
                          if (activeQuote.status === 'PENDING') statusLabel = 'Cerută de client (În Așteptare)';
                          if (activeQuote.status === 'ACCEPTED') statusLabel = 'Acceptată';
                          if (activeQuote.status === 'NEGOTIATING') statusLabel = 'În Negociere';
                          
                          return (
                            <div className="pt-4 flex flex-col items-end gap-2">
                              <div className="text-sm font-medium text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                                Ai deja o ofertă pentru acest proiect: <strong>{statusLabel}</strong>. Gestioneaz-o din meniul Ofertările Mele.
                              </div>
                              <button
                                type="button" disabled
                                className="px-8 py-3 bg-slate-300 text-white font-bold rounded-xl flex items-center gap-2 cursor-not-allowed"
                              >
                                <Send className="w-5 h-5" />
                                Trimite Oferta
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="pt-4 flex justify-end">
                            <button
                              type="submit" disabled={isSubmitting || selectedPhases.length === 0 || !totalAmount || !executionDays}
                              className="px-8 py-3 bg-buildorange hover:bg-orange-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              <Send className="w-5 h-5" />
                              {isSubmitting ? 'Se trimite...' : 'Trimite Oferta'}
                            </button>
                          </div>
                        );
                      })()}
                    </form>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center">
                      <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-amber-900 mb-2">Contul tău necesită validare</h3>
                      <p className="text-amber-700 text-sm">
                        Funcția de ofertare și vizualizarea detaliilor clienților vor deveni active după ce contul tău va fi aprobat de un administrator. Momentan poți doar vizualiza proiectele disponibile pe piață.
                      </p>
                    </div>
                  )}

                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl"
                >
                  <Briefcase className="w-16 h-16 mb-4 opacity-50" />
                  <p>Selectează un proiect din stânga pentru a vedea detaliile.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
