import { useEffect, useState } from 'react';
import { apiPrivate } from '../../api/axios';
import { PackageSearch, Search, SlidersHorizontal, RefreshCw, CheckCircle2, XCircle, Plus, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/useAuth';

interface Material {
  id: number;
  name: string;
  category: string;
  pricePerUnit?: number;
  unit: string;
  inStock?: boolean;
  stockQuantity?: number;
  description?: string;
  uValue?: number;
  compressiveStrength?: number;
  minSeismicZone?: number;
  maxFloors?: number;
  normativeCode?: string;
  storeUrl?: string;
}

export const Materials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toate');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useAuth();

  const fetchMaterials = () => {
    setIsLoading(true);
    apiPrivate.get('/materials')
      .then(res => {
        setMaterials(res.data);
      })
      .catch(err => {
        console.error("Eroare preluare materiale:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await apiPrivate.post('/admin/scrape/sync');
      fetchMaterials();
    } catch (err) {
      console.error("Eroare la sincronizare:", err);
      alert("A apărut o eroare la sincronizare. Verifică consola.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialUrl) return;
    
    setIsAdding(true);
    try {
      // Pentru demo, folosim hardcodări generice care vor fi suprascrise de scraper
      await apiPrivate.post('/admin/scrape/add', {
        url: newMaterialUrl,
        internalCode: `DEDEMAN_${Date.now()}`,
        name: 'Se extrage...', // Va fi suprascris sau păstrat dacă nu găsește
        category: 'Scraping Nou',
        subcategory: 'Altele',
        unit: 'buc'
      });
      setIsAddModalOpen(false);
      setNewMaterialUrl('');
      fetchMaterials();
    } catch (err) {
      console.error("Eroare la adăugare:", err);
      alert("Eroare la importul materialului de pe Dedeman.");
    } finally {
      setIsAdding(false);
    }
  };

  const categories = ['Toate', ...Array.from(new Set(materials.map(m => m.category)))];

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Toate' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Materiale Bricolaj</h1>
          <p className="text-slate-500 mt-1">Găsește cele mai bune oferte de pe piață pentru construcția ta.</p>
        </div>
        
        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Caută material..."
              className="pl-10 pr-4 py-2 bg-transparent outline-none text-slate-900 placeholder:text-slate-400 w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-px bg-slate-200 mx-2"></div>
          
          {/* Buton Filtrează cu Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-buildorange transition-colors h-full rounded-lg"
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span className="font-medium text-sm hidden sm:inline">
                Filtrează {selectedCategory !== 'Toate' && `(${selectedCategory})`}
              </span>
            </button>
            
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 max-h-64 overflow-y-auto"
                >
                  <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Categorii
                  </div>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setIsFilterOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        selectedCategory === cat 
                          ? 'text-buildorange font-semibold bg-orange-50' 
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Adaugă prin URL - Vizibil pentru TOȚI */}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Adaugă prin URL</span>
            <span className="sm:hidden">Adaugă</span>
          </button>
          
          {/* Sincronizare Live - Vizibil DOAR pentru ADMIN */}
          {user?.role === 'admin' && (
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-buildnavy hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-70"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Se sincronizează...' : 'Sincronizare'}</span>
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <div className="w-10 h-10 border-4 border-buildorange border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="py-20 text-center">
          <PackageSearch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900">Nu s-a găsit niciun material.</h3>
          <p className="text-slate-500 mt-2">Încearcă alte cuvinte cheie sau schimbă categoria selectată.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMaterials.map((mat, i) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              key={mat.id}
              onClick={() => { if(mat.storeUrl) window.open(mat.storeUrl, '_blank') }}
              className={`group bg-white border border-slate-200 p-6 rounded-2xl hover:border-buildorange/50 hover:shadow-lg transition-all flex flex-col h-full ${mat.storeUrl ? 'cursor-pointer' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-full truncate max-w-full">
                  {mat.category}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2 group-hover:text-buildorange transition-colors flex items-start gap-2">
                {mat.name}
                {mat.storeUrl && <ExternalLink className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
              </h3>
              
              {mat.description && (
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                  {mat.description}
                </p>
              )}

              {(mat.uValue || mat.compressiveStrength || mat.normativeCode) && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {mat.uValue && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100" title="Coeficient Termic (U-Value)">
                      U: {mat.uValue} W/m²K
                    </span>
                  )}
                  {mat.compressiveStrength && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200" title="Rezistență la Compresiune">
                      Rez: {mat.compressiveStrength} N/mm²
                    </span>
                  )}
                  {mat.normativeCode && (
                    <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100" title="Normativ de referință">
                      {mat.normativeCode}
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex-1"></div>
              
              <div className="mb-4">
                {mat.inStock !== false ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    În Stoc {mat.stockQuantity ? `(${mat.stockQuantity})` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">
                    <XCircle className="w-3.5 h-3.5" />
                    Stoc Epuizat
                  </span>
                )}
              </div>

              <div className="flex items-end justify-between mt-auto pt-4 border-t border-slate-100">
                <div>
                  <span className="text-2xl font-black text-buildorange">{(mat.pricePerUnit ?? 0).toFixed(2)}</span>
                  <span className="text-slate-500 text-sm font-medium ml-1">lei / {mat.unit.toLowerCase()}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Adăugare URL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">Importă Material Dedeman</h3>
              <p className="text-sm text-slate-500 mb-6">
                Lipește link-ul produsului de pe dedeman.ro. Sistemul (Puppeteer) va extrage automat detaliile.
              </p>
              
              <form onSubmit={handleAddMaterial}>
                <input
                  type="url"
                  required
                  placeholder="https://www.dedeman.ro/ro/..."
                  value={newMaterialUrl}
                  onChange={(e) => setNewMaterialUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-buildorange focus:ring-1 focus:ring-buildorange outline-none mb-6"
                />
                
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="flex items-center gap-2 bg-buildorange hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-medium disabled:opacity-70"
                  >
                    {isAdding && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {isAdding ? 'Se extrage...' : 'Importă'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
