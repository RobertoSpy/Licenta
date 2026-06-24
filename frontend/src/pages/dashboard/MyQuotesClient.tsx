import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, FileText, Calendar, DollarSign, MessageSquare, Phone, Mail, User, Building2, MapPin, Award, Layers, Star, X } from 'lucide-react';
import { quoteApi, type Quote } from '../../api/quoteApi';
import { contractorApi } from '../../api/contractorApi';
import { ContractorProfileModal } from '../../components/contractors/ContractorProfileModal';
import { useParams } from 'react-router-dom';

export default function MyQuotesClient() {
  const { id } = useParams<{ id: string }>();
  const currentProjectId = id ? Number(id) : null;
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState<number | null>(null);
  
  const [rejectingQuoteId, setRejectingQuoteId] = useState<number | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');

  // Review State
  const [reviewingQuote, setReviewingQuote] = useState<Quote | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Contractor Profile Modal State
  const [selectedContractor, setSelectedContractor] = useState<Quote['contractor'] | null>(null);

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
      const data = await quoteApi.getClientQuotes(currentProjectId!);
      setQuotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (quoteId: number) => {
    if (!window.confirm('Sigur dorești să accepți această ofertă? Ofertele concurente pentru această etapă vor fi refuzate automat.')) return;
    setIsAccepting(quoteId);
    try {
      await quoteApi.acceptQuote(quoteId);
      alert('Oferta a fost acceptată!');
      fetchQuotes();
    } catch (err) {
      console.error(err);
      alert('Eroare la acceptarea ofertei.');
    } finally {
      setIsAccepting(null);
    }
  };

  const handleReject = async (quoteId: number) => {
    setRejectingQuoteId(quoteId);
    setIsAccepting(quoteId);
    try {
      alert('Momentan, refuzul este automat la acceptarea altei oferte.');
      setRejectingQuoteId(null);
      setRejectMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAccepting(null);
    }
  };

  const handleAddReview = async () => {
    if (!reviewingQuote) return;
    setIsSubmittingReview(true);
    try {
      await contractorApi.addReview(
        reviewingQuote.contractorId,
        reviewingQuote.projectId,
        reviewRating,
        reviewComment
      );
      alert('Recenzia a fost adăugată cu succes! Îți mulțumim!');
      setReviewingQuote(null);
      setReviewRating(5);
      setReviewComment('');
      fetchQuotes();
    } catch (err: any) {
      console.error(err);
      if (err.response?.data?.message === 'ALREADY_REVIEWED' || err.response?.data?.error === 'ALREADY_REVIEWED') {
        alert('Ai acordat deja o recenzie pentru această firmă pe acest proiect.');
      } else {
        alert('Eroare la adăugarea recenziei.');
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!currentProjectId) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p>Te rugăm să selectezi un proiect din dashboard.</p>
      </div>
    );
  }

  // Grupare pe faze
  const quotesByPhase = quotes.reduce((acc, quote) => {
    const phaseName = quote.phases && quote.phases.length > 0 ? quote.phases.map((p: any) => p.name).join(', ') : 'Necunoscută';
    if (!acc[phaseName]) acc[phaseName] = [];
    acc[phaseName].push(quote);
    return acc;
  }, {} as Record<string, Quote[]>);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <FileText className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800 ">Ofertele Mele (Grupate pe Etape)</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
          {[1,2].map(i => <div key={i} className="h-80 bg-slate-200 rounded-2xl"></div>)}
        </div>
      ) : quotes.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <p className="text-slate-500 ">Nu ai primit încă nicio ofertă pentru acest proiect.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(quotesByPhase).map(([phaseName, phaseQuotes]) => (
            <div key={phaseName} className="space-y-6">
              <h2 className="text-2xl font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Layers className="text-buildorange w-6 h-6" />
                Etapa: {phaseName}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {phaseQuotes.map(q => (
                  <motion.div 
                    key={q.id}
                    className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${
                      q.status === 'ACCEPTED' ? 'border-emerald-500 bg-emerald-50/50 ' : 
                      q.status === 'REJECTED' ? 'border-red-200 opacity-60' :
                      'border-slate-200 hover:border-slate-300'
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
                        <div className="flex items-center gap-3 text-slate-700 ">
                          <DollarSign className="h-5 w-5 text-slate-400" />
                          <span className="font-semibold">Preț propus:</span>
                          <span className="text-lg font-bold text-slate-900 ">
                            {q.totalAmount ? `${q.totalAmount.toLocaleString()} RON` : 'Nespecificat'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700 ">
                          <Calendar className="h-5 w-5 text-slate-400" />
                          <span className="font-semibold">Durată execuție:</span>
                          <span>{q.executionDays ? `${q.executionDays} zile` : 'Nespecificat'}</span>
                        </div>

                        {q.message && (
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                              <MessageSquare className="h-4 w-4" />
                              Mesaj de la constructor
                            </div>
                            <p className="text-sm text-slate-600 italic">
                              "{q.message}"
                            </p>
                          </div>
                        )}

                        {!q.acceptsBOM && q.bomVariations && q.bomVariations.length > 0 ? (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="text-amber-600 text-sm flex items-center gap-1 font-bold mb-3">
                              <XCircle className="h-4 w-4" /> Oferta include alternative la materialele din deviz (BOM):
                            </div>
                            <div className="space-y-3">
                              {q.bomVariations.map((v: any, idx: number) => (
                                <div key={idx} className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-sm">
                                  <div className="font-bold text-amber-900 mb-1">
                                    Alternativă propusă: {v.suggestedMaterial}
                                  </div>
                                  <div className="text-amber-800 mb-1">
                                    <span className="font-semibold">Preț nou/unitate:</span> {v.newPrice} RON
                                  </div>
                                  {v.note && (
                                    <div className="text-amber-700 italic">
                                      " {v.note} "
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <span className="text-emerald-600 text-sm flex items-center gap-1 font-bold">
                              <CheckCircle className="h-4 w-4" /> Oferta include exact materialele din deviz (BOM).
                            </span>
                          </div>
                        )}
                      </div>
                    ) : q.status === 'REJECTED' ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-red-400 space-y-2">
                         <p>Ofertă respinsă</p>
                         {q.clientMessage && <p className="text-sm italic">"{q.clientMessage}"</p>}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-500">
                        <p>În așteptarea ofertei...</p>
                      </div>
                    )}

                    {q.status === 'SENT' && (
                      <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col gap-3">
                        <button
                          onClick={() => handleAccept(q.id)}
                          disabled={isAccepting === q.id || rejectingQuoteId === q.id}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isAccepting === q.id ? 'Se procesează...' : <><CheckCircle className="w-5 h-5"/> Acceptă Oferta</>}
                        </button>
                      </div>
                    )}
                    
                    {q.status === 'ACCEPTED' && (
                      <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col gap-3">
                        {q.contractor?.reviews && q.contractor.reviews.length > 0 ? (
                          <div className="w-full py-3 bg-amber-50 text-amber-600 font-bold rounded-xl border border-amber-200 flex items-center justify-center gap-2">
                            <CheckCircle className="w-5 h-5"/> Ai acordat deja o recenzie
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setReviewingQuote(q);
                              setReviewRating(5);
                              setReviewComment('');
                            }}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Star className="w-5 h-5"/> Acordă o Recenzie
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PROFIL CONSTRUCTOR */}
      <ContractorProfileModal 
        contractorId={selectedContractor?.id || null} 
        onClose={() => setSelectedContractor(null)} 
      />

      {/* MODAL RECENZIE */}
      <AnimatePresence>
        {reviewingQuote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setReviewingQuote(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full z-10"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">Acordă o Recenzie</h3>
              <p className="text-sm text-slate-500 mb-6">Cum a decurs colaborarea cu <span className="font-bold">{reviewingQuote.contractor?.companyName || 'Constructorul'}</span>?</p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Punctaj</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star className={`w-8 h-8 ${star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Comentariu</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400"
                  placeholder="Scrie părerea ta aici..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setReviewingQuote(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleAddReview}
                  disabled={isSubmittingReview || !reviewComment.trim()}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmittingReview ? 'Se trimite...' : 'Trimite Recenzia'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
