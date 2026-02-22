import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiPrivate } from '../api/axios';
import { Button } from '../components/ui/Button';
import { Building2, LogOut, Package, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

// Refolosim ce aveam în App.tsx, dar stilat modern
interface Material {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
}

export const Dashboard = () => {
  const { user, logout } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Aici folosim apiPrivate, deci se va atasa automat tokenul
    apiPrivate.get('/materials')
      .then(res => {
        setMaterials(res.data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Eroare fetching: ", err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar Minimalist */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-buildorange p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">BuildWise</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">
            Salut, {user?.name || 'Muncitorule'}
          </span>
          <Button variant="outline" size="sm" onClick={logout} className="gap-2">
            <LogOut className="w-4 h-4" /> Deconectare
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Proiecte</h1>
          <p className="text-slate-500 mt-2">Bine ai venit în centrul tău de control. Explorează materialele disponibile.</p>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Materiale Active</h3>
            <p className="text-3xl font-black mt-2 text-buildnavy">{materials.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Cost Estimativ P/M2</h3>
            <p className="text-3xl font-black mt-2 text-buildnavy">540 RON</p>
          </div>
        </div>

        {/* Material List (din vechiul App.tsx) */}
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Package className="w-6 h-6 text-buildorange" />
          Catalog Bricolaj API
        </h2>

        {isLoading ? (
          <div className="flex justify-center p-20">
            <div className="w-10 h-10 border-4 border-buildorange border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {materials.map((mat, i) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                key={mat.id}
                className="group bg-white border border-slate-200 p-6 rounded-2xl hover:border-buildorange/50 hover:shadow-lg transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider rounded-full">
                    {mat.category}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight mb-4 min-h-[44px]">
                  {mat.name}
                </h3>
                <div className="flex items-end justify-between mt-auto">
                  <div>
                    <span className="text-2xl font-black text-buildorange">{mat.price.toFixed(2)}</span>
                    <span className="text-slate-500 text-sm font-medium ml-1">lei / {mat.unit.toLowerCase()}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
