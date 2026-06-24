import React, { useState, useEffect } from 'react';
import { adminApi, type MaterialDTO } from '../../api/adminApi';
import { Database, Search, Edit2, Trash2, RefreshCw, Plus, CheckCircle, Upload, FileText, X } from 'lucide-react';

export default function AdminMaterials() {
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  // Modals/Forms ar putea fi adăugate, dar pentru MVP simplificăm
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualData, setManualData] = useState({
    internalCode: '', name: '', category: '', subcategory: '', unit: '', pricePerUnit: '',
    storeName: '', storeUrl: '', description: '', uValue: '', compressiveStrength: '',
    packagingUnit: '', packagingValue: ''
  });
  const [unknownCoeffs, setUnknownCoeffs] = useState(false);

  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingSubcategories, setExistingSubcategories] = useState<string[]>([]);
  const [subcategoriesMap, setSubcategoriesMap] = useState<Record<string, string[]>>({});

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  useEffect(() => {
    fetchTaxonomy();
  }, []);

  const fetchTaxonomy = async () => {
    try {
      const res = await adminApi.getTaxonomy();
      if (res.success) {
        setExistingCategories(res.categories);
        setExistingSubcategories(res.allSubcategories);
        setSubcategoriesMap(res.subcategoriesMap);
      }
    } catch (err) {
      console.error('Eroare la preluarea taxonomiei', err);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [page, searchTerm, filterCategory, filterSubcategory]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getMaterials({
        page, limit: 15, search: searchTerm, category: filterCategory, subcategory: filterSubcategory
      });
      if (res.data) {
        setMaterials(res.data);
        setTotalPages(res.pagination?.totalPages || 1);
      } else {
        // fallback legacy if needed
        setMaterials(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMaterial = async (id: number) => {
    try {
      const res = await adminApi.syncMaterial(id);
      setMaterials(materials.map(m => m.id === id ? { ...m, ...res } : m));
      alert('Material sincronizat cu succes!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Eroare la sincronizare.');
    }
  };

  const handleSync = async () => {
    if (!confirm('Această acțiune va prelua prețurile de pe site-urile externe pentru TOATE materialele. Poate dura câteva minute. Ești sigur?')) return;
    
    setSyncing(true);
    setMsg('Sincronizarea a început... Te rugăm să aștepți.');
    try {
      const res = await adminApi.syncMaterials();
      setMsg(res.message || 'Sincronizare completă!');
      fetchMaterials();
    } catch (err) {
      console.error(err);
      setMsg('A apărut o eroare la sincronizare.');
    } finally {
      setSyncing(false);
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ești sigur că vrei să ștergi acest material? Această acțiune este ireversibilă.')) return;
    try {
      await adminApi.deleteMaterial(id);
      setMaterials(materials.filter(m => m.id !== id));
    } catch (err) {
      console.error(err);
      alert('Eroare la ștergere.');
    }
  };

  const handleAddFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    setAdding(true);
    try {
      await adminApi.addMaterialFromUrl({ 
        url: newUrl, 
        internalCode: `AUTO-${Date.now()}`, 
        name: 'Material Adăugat Automat', 
        category: 'Nespecificat', 
        unit: 'Buc' 
      });
      setNewUrl('');
      setMsg('Material adăugat cu succes!');
      fetchMaterials();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Eroare la adăugare.');
    } finally {
      setAdding(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const payload = { ...manualData };
      if (unknownCoeffs) {
        payload.uValue = '';
        payload.compressiveStrength = '';
      }
      await adminApi.addMaterialManual(payload);
      setIsManualModalOpen(false);
      setManualData({ internalCode: '', name: '', category: '', subcategory: '', unit: '', pricePerUnit: '', storeName: '', storeUrl: '', description: '', uValue: '', compressiveStrength: '', packagingUnit: '', packagingValue: '' });
      setUnknownCoeffs(false);
      setMsg('Material adăugat manual cu succes!');
      fetchMaterials();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Eroare la adăugare manuală.');
    } finally {
      setAdding(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleUploadCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setUploadingCsv(true);
    try {
      const res = await adminApi.uploadMaterialsCsv(csvFile);
      setIsCsvModalOpen(false);
      setCsvFile(null);
      setMsg(res.message || 'Import CSV finalizat!');
      fetchMaterials();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Eroare la import CSV.');
    } finally {
      setUploadingCsv(false);
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const filtered = materials.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.internalCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-950/50 rounded-xl text-red-500">
            <Database className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-white">Bază Date Materiale</h1>
        </div>
        
        <button 
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Se Sincronizează...' : 'Sincronizare Dedeman (Web Scraping)'}
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-950/30 text-emerald-400 p-4 rounded-xl border border-emerald-900/50 flex items-center gap-2 font-medium">
          <CheckCircle className="w-5 h-5" />
          {msg}
        </div>
      )}

      {/* Adăugare Rapida */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col xl:flex-row justify-between gap-8">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-4">Adaugă material prin URL</h3>
            <form onSubmit={handleAddFromUrl} className="flex gap-4">
              <input 
                type="url" 
                required
                placeholder="https://www.dedeman.ro/..."
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-red-500"
              />
              <button 
                type="submit" 
                disabled={adding}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold transition-colors border border-slate-700"
              >
                <Plus className="w-5 h-5" />
                {adding ? 'Se Scrapează...' : 'Adaugă'}
              </button>
            </form>
          </div>
          
          <div className="w-px bg-slate-800 hidden xl:block"></div>
          
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Adăugare în Masă / Manual</h3>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsManualModalOpen(true)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition-colors border border-slate-700"
              >
                <Plus className="w-5 h-5" />
                Adaugă Manual
              </button>
              <button 
                onClick={() => setIsCsvModalOpen(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-colors"
              >
                <FileText className="w-5 h-5" />
                Importă din CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="relative w-full md:w-1/3">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Caută materiale..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">Toate Categoriile</option>
              {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterSubcategory}
              onChange={(e) => { setFilterSubcategory(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">Toate Subcategoriile</option>
              {existingSubcategories.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-sm">
                <th className="pb-3 font-semibold">Cod Intern</th>
                <th className="pb-3 font-semibold">Nume Material</th>
                <th className="pb-3 font-semibold">Categorie</th>
                <th className="pb-3 font-semibold">Preț Curent</th>
                <th className="pb-3 font-semibold">Stoc</th>
                <th className="pb-3 font-semibold text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Se încarcă...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Nu a fost găsit niciun material.</td>
                </tr>
              ) : (
                filtered.map(mat => (
                  <tr key={mat.id} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 text-slate-400 font-mono text-xs">{mat.internalCode}</td>
                    <td className="py-4">
                      <div className="font-bold text-slate-200 truncate max-w-xs" title={mat.name}>{mat.name}</div>
                      {mat.storeUrl && (
                        <a href={mat.storeUrl} target="_blank" rel="noreferrer" className="text-red-400 hover:underline text-xs">
                          {mat.storeName || 'Link Magazin'}
                        </a>
                      )}
                    </td>
                    <td className="py-4 text-slate-400">{mat.category} <span className="opacity-50">/ {mat.subcategory}</span></td>
                    <td className="py-4 font-bold text-emerald-400">{mat.pricePerUnit} RON <span className="text-slate-500 text-xs font-normal">/ {mat.unit}</span></td>
                    <td className="py-4">
                      {mat.inStock ? (
                        <span className="px-2 py-1 bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 rounded text-xs font-bold uppercase">În Stoc</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-950/30 text-red-400 border border-red-900/50 rounded text-xs font-bold uppercase">Stoc Epuizat</span>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-blue-400 hover:text-white hover:bg-blue-900/50 rounded transition-colors" title="Editează">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {mat.storeUrl && (
                          <button onClick={() => handleSyncMaterial(mat.id)} className="p-2 text-green-400 hover:text-white hover:bg-green-900/50 rounded transition-colors" title="Sincronizează Preț">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(mat.id)}
                          className="p-2 text-red-400 hover:text-white hover:bg-red-900/50 rounded transition-colors" title="Șterge"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginație */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <span className="text-sm text-slate-400">
              Pagina {page} din {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white disabled:opacity-50"
              >
                Înapoi
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white disabled:opacity-50"
              >
                Înainte
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Adaugare Manuala */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Adaugă Material Manual</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddManual} className="space-y-6">
              
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4">
                <h4 className="font-bold text-slate-300 text-sm uppercase tracking-wider">Informații de Bază</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Cod Intern *</label>
                    <input type="text" required value={manualData.internalCode} onChange={e => setManualData({...manualData, internalCode: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Nume Material *</label>
                    <input type="text" required value={manualData.name} onChange={e => setManualData({...manualData, name: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Categorie *</label>
                    <input type="text" list="categories" required value={manualData.category} onChange={e => setManualData({...manualData, category: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                    <datalist id="categories">
                      {existingCategories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Subcategorie *</label>
                    <input type="text" list="subcategories" required value={manualData.subcategory} onChange={e => setManualData({...manualData, subcategory: e.target.value})} placeholder="ex: CONCRETE_C25_30" className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                    <datalist id="subcategories">
                      {existingSubcategories.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Unitate Măsură *</label>
                    <input type="text" required value={manualData.unit} onChange={e => setManualData({...manualData, unit: e.target.value})} placeholder="ex: mc, mp, buc" className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Preț per Unitate *</label>
                    <input type="number" step="0.01" required value={manualData.pricePerUnit} onChange={e => setManualData({...manualData, pricePerUnit: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Cantitate Ambalaj (ex: 25)</label>
                    <input type="number" step="0.01" value={manualData.packagingValue} onChange={e => setManualData({...manualData, packagingValue: e.target.value})} placeholder="ex: 25" className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Unitate Ambalaj (ex: kg, L)</label>
                    <input type="text" value={manualData.packagingUnit} onChange={e => setManualData({...manualData, packagingUnit: e.target.value})} placeholder="ex: kg" className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4">
                <h4 className="font-bold text-slate-300 text-sm uppercase tracking-wider">Origine (Magazin)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Link URL Magazin</label>
                    <input type="url" placeholder="https://..." value={manualData.storeUrl} onChange={e => setManualData({...manualData, storeUrl: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                    <p className="text-xs text-slate-500 mt-1">Dacă lași Numele Magazinului gol, se va deduce automat din link.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Nume Magazin (Opțional)</label>
                    <input type="text" placeholder="ex: Dedeman" value={manualData.storeName} onChange={e => setManualData({...manualData, storeName: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1">Descriere Textuală</label>
                    <textarea rows={2} value={manualData.description} onChange={e => setManualData({...manualData, description: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white resize-none" placeholder="Detalii tehnice despre material..." />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-300 text-sm uppercase tracking-wider">Coeficienți Tehnici</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={unknownCoeffs} onChange={e => setUnknownCoeffs(e.target.checked)} className="w-4 h-4 text-red-600 bg-slate-900 border-slate-700 rounded focus:ring-red-600" />
                    <span className="text-sm font-medium text-slate-300">Nu cunosc (Lasă Necunoscut)</span>
                  </label>
                </div>
                {!unknownCoeffs && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Coef. Termic (uValue)</label>
                      <input type="number" step="0.001" placeholder="W/m²K" value={manualData.uValue} onChange={e => setManualData({...manualData, uValue: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Rezistență Compresiune</label>
                      <input type="number" step="0.1" placeholder="N/mm²" value={manualData.compressiveStrength} onChange={e => setManualData({...manualData, compressiveStrength: e.target.value})} className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                    </div>
                  </div>
                )}
                {unknownCoeffs && (
                  <div className="text-sm text-slate-500 italic p-3 bg-slate-900 rounded-lg border border-slate-800">
                    Sistemul va marca acești coeficienți ca "Necunoscuți" (valoarea null în baza de date), astfel încât motorul BOM să poată folosi fallback-urile predefinite la calcule.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Anulează</button>
                <button type="submit" disabled={adding} className="bg-red-600 hover:bg-red-700 text-white px-8 py-2.5 rounded-lg font-bold disabled:opacity-50 transition-colors">
                  {adding ? 'Se Salvează...' : 'Salvează Materialul'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import CSV */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Importă Materiale din CSV</h3>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-300 font-medium mb-3">
                Fișierul CSV trebuie să conțină coloanele corecte pe primul rând (header).
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs px-2 py-1 bg-red-900/30 text-red-400 border border-red-900/50 rounded">internalCode (obligatoriu)</span>
                <span className="text-xs px-2 py-1 bg-red-900/30 text-red-400 border border-red-900/50 rounded">name (obligatoriu)</span>
                <span className="text-xs px-2 py-1 bg-red-900/30 text-red-400 border border-red-900/50 rounded">category (obligatoriu)</span>
                <span className="text-xs px-2 py-1 bg-red-900/30 text-red-400 border border-red-900/50 rounded">pricePerUnit (obligatoriu)</span>
                <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded">subcategory</span>
                <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded">storeUrl</span>
                <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded">uValue</span>
                <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded">compressiveStrength</span>
                <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded">packagingUnit</span>
                <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded">packagingValue</span>
              </div>
              <button 
                onClick={() => {
                  const csvContent = "data:text/csv;charset=utf-8,internalCode,name,category,subcategory,unit,pricePerUnit,storeUrl,description,uValue,compressiveStrength,packagingUnit,packagingValue\nMAT-001,Caramida Porotherm,Structură,Zidărie Cărămidă,buc,10.5,https://dedeman.ro/caramida,Caramida eficienta,0.25,10,buc,1\n";
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "template_materiale.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="text-sm text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors font-medium"
              >
                <FileText className="w-4 h-4" /> Descarcă Template CSV Exemplu
              </button>
            </div>

            <form onSubmit={handleUploadCsv} className="space-y-4">
              <input type="file" accept=".csv" required onChange={e => setCsvFile(e.target.files ? e.target.files[0] : null)} className="w-full text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer" />
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsCsvModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Anulează</button>
                <button type="submit" disabled={uploadingCsv || !csvFile} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-colors">
                  <Upload className="w-4 h-4" />
                  {uploadingCsv ? 'Se importă...' : 'Importă Acum'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
