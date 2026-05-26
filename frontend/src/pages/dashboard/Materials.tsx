import { useEffect, useState } from 'react';
import { apiPrivate } from '../../api/axios';
import { PackageSearch, Search, SlidersHorizontal, RefreshCw, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Material {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  inStock?: boolean;
  stockQuantity?: number;
  description?: string;
}

export const Materials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toate');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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
          <div className="w-px bg-slate-200 mx-2 hidden md:block"></div>
          <button className="hidden md:flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-buildorange transition-colors">
            <SlidersHorizontal className="w-5 h-5" />
            <span className="font-medium text-sm">Filtrează</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Adaugă prin URL
          </button>
          
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-buildnavy hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-70"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Se sincronizează...' : 'Sincronizare Live'}
          </button>
        </div>
      </div>

      {/* Categories Horizontal Scroll */}
      <div className="flex overflow-x-auto gap-2 pb-4 mb-4 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all ${selectedCategory === cat
                ? 'bg-buildnavy text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-buildorange/50 hover:text-buildorange'
              }`}
          >
            {cat}
          </button>
        ))}
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
              className="group bg-white border border-slate-200 p-6 rounded-2xl hover:border-buildorange/50 hover:shadow-lg transition-all flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-full truncate max-w-full">
                  {mat.category}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2 flex-1">
                {mat.name}
              </h3>
              
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
                  <span className="text-2xl font-black text-buildorange">{mat.price.toFixed(2)}</span>
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
