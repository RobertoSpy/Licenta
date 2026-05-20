import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wand2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (area: number, style: string, bedrooms: number) => Promise<void>;
  initialArea: number;
  initialStyle: string;
}

export const GenerateLayoutModal: React.FC<Props> = ({ isOpen, onClose, onGenerate, initialArea, initialStyle }) => {
  const [area, setArea] = useState(initialArea || 80);
  const [style, setStyle] = useState(initialStyle || 'Modern');
  const [bedrooms, setBedrooms] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const styles = ['Modern', 'Clasic', 'Industrial', 'Mediteranean', 'Rustic'];

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError('');
      await onGenerate(area, style, bedrooms);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Eroare la generarea planului.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-black text-slate-900">Autogenerare Plan</h2>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <p className="text-sm text-slate-600">
              Setează parametrii pentru generarea unui plan de plecare. AI-ul va împărți spațiul respectând normele legale minime (Legea 114/1996).
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Suprafață construită (m²)
                </label>
                <input
                  type="number"
                  min="30"
                  max="500"
                  value={area}
                  onChange={(e) => setArea(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Stil Arhitectural
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                >
                  {styles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Număr Dormitoare
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(num => (
                    <button
                      key={num}
                      onClick={() => setBedrooms(num)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                        bedrooms === num 
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Anulează
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Se generează...
                </>
              ) : (
                'Generează Plan'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
