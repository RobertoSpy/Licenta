import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Clock, CheckCircle, FileText, XCircle, Send, Lock, Layers } from 'lucide-react';
import { quoteApi, type Quote } from '../../api/quoteApi';
import { apiPrivate } from '../../api/axios';
import { useOutletContext } from 'react-router-dom';

export default function QuoteRequestsList() {
 const { isVerified } = useOutletContext<{ isVerified: boolean | null }>();
 const [quotes, setQuotes] = useState<Quote[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

 // Formular trimitere ofertă
 const [totalAmount, setTotalAmount] = useState<string>('');
 const [executionDays, setExecutionDays] = useState<string>('');
 const [message, setMessage] = useState('');
 const [acceptsBOM, setAcceptsBOM] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);

 useEffect(() => {
 fetchQuotes();
 }, []);

 const fetchQuotes = async () => {
 setLoading(true);
 try {
 const data = await quoteApi.getContractorQuotes();
 setQuotes(data);
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 };

 const handleSubmitQuote = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedQuote) return;

 setIsSubmitting(true);
 try {
 await quoteApi.submitQuote(selectedQuote.id, {
 totalAmount: Number(totalAmount),
 executionDays: Number(executionDays),
 message,
 acceptsBOM
 });
 alert('Oferta a fost trimisă cu succes!');
 setSelectedQuote(null);
 fetchQuotes();
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
 <Inbox className="h-8 w-8 text-buildorange" />
 <h1 className="text-3xl font-bold text-slate-800 ">Cereri de Ofertă (Lead-uri)</h1>
 </div>

 {loading ? (
 <div className="space-y-4 animate-pulse">
 {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>)}
 </div>
 ) : quotes.length === 0 ? (
 <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
 <p className="text-slate-500 ">Nu ai primit nicio cerere de ofertă încă.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Lista cererilor */}
 <div className="lg:col-span-1 flex flex-col gap-4">
 {quotes.map(q => (
 <div 
 key={q.id}
 onClick={() => {
 setSelectedQuote(q);
 setTotalAmount(q.totalAmount?.toString() || '');
 setExecutionDays(q.executionDays?.toString() || '');
 setMessage(q.message || '');
 setAcceptsBOM(q.acceptsBOM !== false);
 }}
 className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
 selectedQuote?.id === q.id 
 ? 'border-buildorange bg-orange-50 ' 
 : 'border-slate-200 bg-white hover:border-buildorange'
 }`}
 >
 <div className="flex justify-between items-start mb-2">
 <h4 className="font-bold text-slate-900 truncate">Proiect #{q.projectId}</h4>
 <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
 q.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
 q.status === 'SENT' ? 'bg-orange-100 text-orange-700' :
 q.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
 q.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
 'bg-slate-100 text-slate-600'
 }`}>
 {q.status}
 </span>
 </div>
 <p className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
   <Layers className="w-3 h-3" />
    {q.phases && q.phases.length > 0 ? q.phases.map((p: any) => p.name).join(', ') : 'Etape Nespecificate'}
 </p>
 <p className="text-xs text-slate-500 flex items-center gap-1">
 <Clock className="w-3 h-3" />
 {new Date(q.createdAt).toLocaleDateString()}
 </p>
 <p className="text-sm font-medium mt-2">
 Client: {isVerified === false ? '[Ascuns - Necesită Validare]' : q.project?.user?.name || 'Anonim'}
 </p>
 </div>
 ))}
 </div>

 {/* Vizualizare și Ofertare */}
 <div className="lg:col-span-2">
 <AnimatePresence mode="wait">
 {selectedQuote ? (
 <motion.div
 key="selected"
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -20 }}
 className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm"
 >
 <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center justify-between">
 <span>Detalii Proiect #{selectedQuote.projectId} - Etape: {selectedQuote.phases?.map((p: any) => p.name).join(', ')}</span>
 <span className="text-sm font-normal px-3 py-1 bg-slate-100 rounded-lg">
 Status: <strong className="uppercase">{selectedQuote.status}</strong>
 </span>
 </h2>

 <div className="grid grid-cols-2 gap-6 mb-8">
 <div className="bg-slate-50 p-4 rounded-xl">
 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date Generale</h4>
 <ul className="text-sm text-slate-700 space-y-1">
 <li><strong>Client:</strong> {isVerified === false ? '[Ascuns]' : selectedQuote.project?.user?.name}</li>
 <li><strong>Județ:</strong> {selectedQuote.project?.county || 'Nespecificat'}</li>
 <li><strong>Tip construcție:</strong> {selectedQuote.project?.buildingPurpose || 'Rezidențial'}</li>
 <li><strong>Zonă seismică:</strong> {selectedQuote.project?.seismicZone || '?'}</li>
 </ul>
 </div>

 <div className="bg-slate-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
 <FileText className="w-8 h-8 text-buildorange mb-2" />
 <p className="text-sm font-bold text-slate-700 ">
 {selectedQuote.project?.bomItems?.length || 0} Materiale în Deviz (BOM)
 </p>
 <div className="flex flex-col gap-2 w-full mt-3">
 <button 
 onClick={async () => {
 try {
 const res = await apiPrivate.post(`/export/plan-pdf/${selectedQuote.projectId}`, {}, { responseType: 'blob' });
 const url = window.URL.createObjectURL(new Blob([res.data]));
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `Plan2D_${selectedQuote.projectId}.pdf`);
 document.body.appendChild(link);
 link.click();
 } catch (e) {
 alert('Eroare la descărcarea planului 2D. Este posibil să nu existe.');
 }
 }}
 className="w-full text-xs font-bold text-buildorange bg-orange-50 hover:bg-orange-100 py-2 rounded-lg transition-colors"
 >
 Descarcă Plan 2D (PDF)
 </button>
 
 <button 
 onClick={async () => {
 try {
 const res = await apiPrivate.get(`/bom/${selectedQuote.projectId}/export-pdf`, { responseType: 'blob' });
 const url = window.URL.createObjectURL(new Blob([res.data]));
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `DevizBOM_${selectedQuote.projectId}.pdf`);
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

 {selectedQuote.status === 'PENDING' && isVerified !== false ? (
 <form onSubmit={handleSubmitQuote} className="space-y-6">
 <h3 className="text-xl font-bold text-slate-900 mb-4">Trimite Oferta Ta pentru această etapă</h3>
 
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

 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 ">
 <input 
 type="checkbox" id="acceptsBOM"
 checked={acceptsBOM} onChange={e => setAcceptsBOM(e.target.checked)}
 className="w-5 h-5 rounded border-slate-300 text-buildorange focus:ring-buildorange"
 />
 <label htmlFor="acceptsBOM" className="text-sm font-medium text-slate-700 cursor-pointer">
 Sunt de acord cu devizul generat (BOM). Nu propun variante de materiale.
 </label>
 </div>

 <div className="pt-4 flex justify-end">
 <button
 type="submit" disabled={isSubmitting}
 className="px-8 py-3 bg-buildorange hover:bg-orange-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
 >
 <Send className="w-5 h-5" />
 {isSubmitting ? 'Se trimite...' : 'Trimite Oferta'}
 </button>
 </div>
 </form>
 ) : selectedQuote.status === 'PENDING' && isVerified === false ? (
 <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center">
 <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
 <h3 className="text-lg font-bold text-amber-900 mb-2">Contul tău necesită validare</h3>
 <p className="text-amber-700 text-sm">
 Funcția de ofertare și vizualizarea detaliilor clienților vor deveni active după ce contul tău va fi aprobat de un administrator. Momentan poți doar vizualiza proiectele disponibile pe piață.
 </p>
 </div>
 ) : (
 <div className={`p-6 rounded-xl border ${selectedQuote.status === 'REJECTED' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
 <h3 className={`text-lg font-bold mb-4 ${selectedQuote.status === 'REJECTED' ? 'text-red-900' : ''}`}>
   {selectedQuote.status === 'REJECTED' ? 'Oferta a fost refuzată de client' : 'Oferta Trimisă'}
 </h3>
 
 {selectedQuote.status === 'REJECTED' && selectedQuote.clientMessage && (
   <div className="mb-4 p-4 bg-white rounded-lg border border-red-100 shadow-sm">
     <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Mesaj de la client:</p>
     <p className="text-sm text-slate-700 italic">"{selectedQuote.clientMessage}"</p>
   </div>
 )}

 <div className="space-y-2 text-sm">
 <p><strong>Preț total:</strong> {selectedQuote.totalAmount?.toLocaleString()} RON</p>
 <p><strong>Zile execuție:</strong> {selectedQuote.executionDays}</p>
 <p><strong>Mesajul tău:</strong> {selectedQuote.message || '-'}</p>
 </div>
 </div>
 )}

 </motion.div>
 ) : (
 <motion.div
 key="empty"
 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
 className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl"
 >
 <Inbox className="w-16 h-16 mb-4 opacity-50" />
 <p>Selectează o cerere din stânga pentru a vedea detaliile.</p>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 )}
 </div>
 );
}
