import { useEffect, useState } from 'react';
import { apiPrivate } from '../../api/axios';
import { Button } from '../../components/ui/Button';
import { Plus, Building, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

interface Project {
  id: number;
  title: string;
  createdAt: string;
  bomItems?: any[];
}

export const MyProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiPrivate.get('/projects')
      .then(res => {
        setProjects(res.data);
      })
      .catch(err => {
        console.error("Eroare preluare proiecte:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Proiectele Mele</h1>
          <p className="text-slate-500 mt-1">Gestionează-ți construcțiile și vizionează devizele.</p>
        </div>
        <Button className="gap-2 shadow-lg shadow-buildorange/20">
          <Plus className="w-5 h-5" />
          Proiect Nou
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <div className="w-10 h-10 border-4 border-buildorange border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <Building className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Niciun proiect momentan</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Începe prin a crea un proiect nou. Modela-ți casa în 2D și afli costurile exacte cu materialele din piață.
          </p>
          <Button className="gap-2">
            <Plus className="w-5 h-5" /> Creează primul proiect
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={proj.id}
              className="bg-white border border-slate-200 p-6 rounded-2xl hover:border-buildorange/50 hover:shadow-xl transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 bg-orange-50 text-buildorange rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-xl mb-1">{proj.title}</h3>
              <p className="text-sm text-slate-500 mb-6 flex items-center gap-1">
                Creat la: {new Date(proj.createdAt).toLocaleDateString()}
              </p>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-sm font-medium text-slate-600">
                  {proj.bomItems?.length || 0} materiale
                </div>
                <div className="text-buildorange font-semibold text-sm hover:underline">
                  Vezi detalii &rarr;
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
