import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, FileText, Calendar, DollarSign, MessageSquare } from 'lucide-react';
import { quoteApi, type Quote } from '../../api/quoteApi';
import { useParams } from 'react-router-dom';

export default function MyQuotesClient() {
  const { id } = useParams<{ id: string }>();
  const currentProjectId = id ? Number(id) : null;
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState<number | null>(null);

  // Review State
  const [reviewQuoteId, setReviewQuoteId] = useState<number | null>(null);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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
    if (!confirm('Ești sigur că vrei să accepți această ofertă? Celelalte oferte vor fi respinse automat.')) return;
    
    setIsAccepting(quoteId);
    try {
      await quoteApi.acceptQuote(quoteId);
      await fetchQuotes();
    } catch (err) {
      console.error(err);
      alert('Eroare la acceptarea ofertei.');
    } finally {
      setIsAccepting(null);
    }
  };

  const handleSubmitReview = async (contractorId: number) => {
    if (!currentProjectId) return;
    setIsSubmittingReview(true);
    try {
      // @ts-ignore
      await quoteApi.addReview(contractorId, currentProjectId, reviewData.rating, reviewData.comment);
      alert('Recenzie adăugată cu succes!');
      setReviewQuoteId(null);
      setReviewData({ rating: 5, comment: '' });
      fetchQuotes(); // refresh
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Eroare la adăugarea recenziei.');
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
                'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {q.contractor?.companyName || 'Constructor Necunoscut'}
                  </h3>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold mt-2 ${
                    q.status === 'PENDING' ? 'bg-slate-100 text-slate-600' :
                    q.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                    q.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {q.status}
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

                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-semibold block mb-2 text-slate-700 dark:text-slate-300">Variante deviz (BOM):</span>
                    {q.acceptsBOM ? (
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> Constructorul acceptă integral devizul propus de Zidario.
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 text-sm flex items-center gap-1">
                        Constructorul a propus modificări (vezi detalii).
                      </span>
                    )}
                  </div>

                  {/* Add Review section if ACCEPTED */}
                  {q.status === 'ACCEPTED' && (
                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                      {reviewQuoteId === q.id ? (
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-sm">Lasă o recenzie constructorului</h4>
                          <div className="mb-3">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Rating (1-5)</label>
                            <input 
                              type="number" min="1" max="5" 
                              value={reviewData.rating} 
                              onChange={e => setReviewData({...reviewData, rating: Number(e.target.value)})}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 text-sm" 
                            />
                          </div>
                          <div className="mb-4">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Comentariu</label>
                            <textarea 
                              rows={3}
                              value={reviewData.comment}
                              onChange={e => setReviewData({...reviewData, comment: e.target.value})}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 text-sm"
                              placeholder="Cum a decurs colaborarea?"
                            ></textarea>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setReviewQuoteId(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                              Anulează
                            </button>
                            <button 
                              onClick={() => handleSubmitReview(q.contractorId)}
                              disabled={isSubmittingReview}
                              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              {isSubmittingReview ? 'Se trimite...' : 'Trimite Recenzia'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReviewQuoteId(q.id)}
                          className="w-full py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 font-bold rounded-xl transition-colors border border-blue-200 dark:border-blue-800/30"
                        >
                          Evaluează Constructorul
                        </button>
                      )}
                    </div>
                  )}
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
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isAccepting === q.id ? 'Se acceptă...' : 'Acceptă Oferta'}
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
