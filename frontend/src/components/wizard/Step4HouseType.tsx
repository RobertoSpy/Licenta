import { motion } from 'framer-motion';
import { Building2, Palette, Info, Check, AlertCircle } from 'lucide-react';
import type { ProjectFormData } from './ProjectWizard';

interface Props {
  data: ProjectFormData;
  updateData: (fields: Partial<ProjectFormData>) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { 
      type: "spring" as const, 
      stiffness: 300, 
      damping: 20, 
      mass: 0.8 
    }
  },
  whileHover: { 
    scale: 1.02, 
    y: -5,
    transition: { type: "spring" as const, stiffness: 400, damping: 10 }
  },
  whileTap: { scale: 0.98 }
};

const styles = [
  { id: 'Modern', name: 'Minimalist / Modern', desc: 'Linii drepte, ferestre mari, acoperiș tip terasă sau pantă mică.', color: 'blue' },
  { id: 'Clasic', name: 'Clasic Românesc', desc: 'Eleganță atemporală, simetrie și detalii decorative rafinate.', color: 'amber' },
  { id: 'Mediteranean', name: 'Mediteranean', desc: 'Arce de cerc, terase generoase și culori calde, pământii.', color: 'orange' },
  { id: 'Industrial', name: 'Industrial / Loft', desc: 'Mix de cărămidă, metal și beton aparent. Aspect brut.', color: 'slate' }
];

export const Step4HouseType = ({ data, updateData }: Props) => {
  const maxFloors = data.maxAllowedFloors || 2;

  const toggleBasement = () => updateData({ hasBasement: !data.hasBasement });
  const toggleMansard = () => updateData({ hasMansard: !data.hasMansard });
  const setUpperFloors = (count: number) => {
    if (count + 1 > maxFloors) return; // Parterul e implicit inclus in limita
    updateData({ upperFloorsCount: count });
  };



  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="h-full space-y-10"
    >
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-black text-slate-900 mb-2">Viziunea Arhitecturală</h2>
        <p className="text-slate-500">Alege stilul care te reprezintă și configurează regimul de înălțime dorit.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Style Selection - Staggered Cards */}
        <section className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" /> 1. Stil Arhitectural
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {styles.map((style) => (
              <motion.div
                key={style.id}
                variants={cardVariants}
                whileHover="whileHover"
                whileTap="whileTap"
                onClick={() => updateData({ houseStyle: style.id })}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-colors relative overflow-hidden ${
                  data.houseStyle === style.id 
                  ? 'border-indigo-600 bg-indigo-50/50' 
                  : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900">{style.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">{style.desc}</p>
                  </div>
                  {data.houseStyle === style.id && (
                    <div className="bg-indigo-600 text-white rounded-full p-1">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Configuration Selection */}
        <section className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-600" /> 2. Regim de Înălțime
          </h3>
          
          <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-8">
            {/* Basement Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900">Subsol Tehnic</h4>
                <p className="text-xs text-slate-500">Recomandat pentru spații de depozitare sau garaj.</p>
              </div>
              <button 
                onClick={toggleBasement}
                className={`w-14 h-8 rounded-full transition-colors relative ${data.hasBasement ? 'bg-amber-500' : 'bg-slate-200'}`}
              >
                <motion.div 
                  animate={{ x: data.hasBasement ? 24 : 4 }}
                  className="w-6 h-6 bg-white rounded-full absolute top-1 shadow-sm"
                />
              </button>
            </div>

            {/* Upper Floors Selector */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <h4 className="font-bold text-slate-900 text-sm italic opacity-70">Niveluri supraterane:</h4>
                <span className="text-xs font-bold text-slate-400">Limită locală: P + {maxFloors - 1}</span>
              </div>
              
              <div className="flex gap-4">
                {[0, 1, 2].map((count) => {
                  const total = 1 + count; // Parter + Etaje
                  const isBlocked = total > maxFloors;
                  const isActive = data.upperFloorsCount === count;

                  return (
                    <button
                      key={count}
                      disabled={isBlocked}
                      onClick={() => setUpperFloors(count)}
                      className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all relative ${
                        isActive 
                        ? 'border-amber-500 bg-amber-50 text-amber-900' 
                        : isBlocked 
                        ? 'border-slate-50 bg-slate-50 opacity-40 cursor-not-allowed'
                        : 'border-slate-100 hover:border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="text-xl font-black">{count === 0 ? 'P' : `P+${count}`}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">{count === 0 ? 'Doar parter' : `${count} Etaj${count > 1 ? 'e' : ''}`}</span>
                      {isBlocked && (
                        <div className="absolute -top-1 -right-1">
                           <AlertCircle className="w-4 h-4 text-slate-400 fill-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mansard Toggle */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900">Mansardă Locuibilă</h4>
                <p className="text-xs text-slate-500">Transformă podul în spațiu activ de locuit.</p>
              </div>
              <button 
                onClick={toggleMansard}
                className={`w-14 h-8 rounded-full transition-colors relative ${data.hasMansard ? 'bg-amber-500' : 'bg-slate-200'}`}
              >
                <motion.div 
                  animate={{ x: data.hasMansard ? 24 : 4 }}
                  className="w-6 h-6 bg-white rounded-full absolute top-1 shadow-sm"
                />
              </button>
            </div>

            {/* Summary Alert */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Configurația aleasă va genera automat structura devizului de materiale necesare pentru rezistență. 
                Opțiunile indisponibile sunt filtrate pe baza analizei seismice de la pasul anterior.
              </p>
            </div>
          </div>
        </section>

      </div>
    </motion.div>
  );
};
