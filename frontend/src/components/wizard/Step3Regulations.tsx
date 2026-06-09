import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Ruler, AlertTriangle, Brain, Info, Loader2 } from 'lucide-react';
import { getAccessToken } from '../../api/axios';
import type { ProjectFormData } from './ProjectWizard';

interface Props {
  data: ProjectFormData;
  updateData: (fields: Partial<ProjectFormData>) => void;
  addSystemMessage?: (message: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
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
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 }
  }
};

export const Step3Regulations = ({ data, updateData }: Props) => {
  const [isPredicting, setIsPredicting] = useState(true);
  const [aiExplanation, setAiExplanation] = useState("");
  const aiExplanationRef = useRef("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const streamStarted = useRef(false);

  useEffect(() => {
    // Simulam analiza determinista (care vine din backend deja populata in data de Step 1)
    const timer = setTimeout(() => setIsPredicting(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPredicting && !streamStarted.current) {
      streamStarted.current = true;
      startAiStreaming();
    }
  }, [isPredicting]);

  const startAiStreaming = async () => {
    setIsAiLoading(true);
    try {
      const token = getAccessToken();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
body: JSON.stringify({
  message: `Fă o sinteză tehnică, dar prietenoasă, a proiectului (max 5-6 rânduri) pentru un om non-tehnic. Ai datele: Județ ${data.county}, zonă seismică ${data.seismicZone}, adâncime îngheț ${data.frostDepthCm}cm. Casa are stil arhitectural ${data.houseStyle}, cu regim de înălțime P+${data.upperFloorsCount}${data.hasBasement ? ' și subsol' : ''}. Integrează aspecte despre arhitectură (cum influențează terenul și stilul ales structura de rezistență și compartimentarea), eficiență energetică (certificat energetic / norme NZEB) și un scurt sfat despre estimarea financiară/costul materialelor. Amintește-i că trebuie să ceară Certificatul de Urbanism de la primărie (maxim admis tehnic național: P+${data.maxAllowedFloors}). Nu pune întrebări la final.`,
  screenContext: 'wizard',
  contextString: `
    Județ: ${data.county}
    Localitate: ${data.locality}
    Zonă seismică: ${data.seismicZone}
    Adâncime îngheț: ${data.frostDepthCm}cm
    Maximum tehnic etaje: P+${data.maxAllowedFloors}
    Adâncime minimă fundație: ${data.minFoundationDepthCm}cm
    Stil casă: ${data.houseStyle}
    Subsol: ${data.hasBasement ? 'Da' : 'Nu'}
    Etaje superioare: ${data.upperFloorsCount}
  `.trim()
})
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              setAiExplanation(prev => {
                const newText = prev + parsed.text;
                aiExplanationRef.current = newText;
                return newText;
              });
            } catch { /* ignore malformed SSE chunk */ }
          }
        }
      }
      updateData({ zoningRestrictions: aiExplanationRef.current });
    } catch {
      setAiExplanation("Eroare la generarea explicației AI. Te rugăm să verifici conexiunea.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Determinarea limitei administrative de etaje (logica determinista)
const maxFloors = data.maxAllowedFloors ?? 4;
  
  useEffect(() => {
    if (maxFloors !== data.maxAllowedFloors) {
      updateData({ maxAllowedFloors: maxFloors, minFoundationDepthCm: (data.frostDepthCm || 90) + 10 });
    }
  }, [maxFloors, data.frostDepthCm]);

  if (isPredicting) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-8 p-10">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-24 h-24 border-4 border-slate-200 border-t-buildorange rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-8 h-8 text-buildorange animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Predicting...</h2>
          <p className="text-slate-500 font-medium">Interogăm normativele P100-1/2013 și NP112 pentru locația ta.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="h-full space-y-8"
    >
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-black text-slate-900 mb-2">Reglementări & Limite Tehnice</h2>
        <p className="text-slate-500">Am corelat coordonatele GPS cu baza de date a normativelor naționale pentru a stabili limitele de siguranță.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Seismicitate */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
             <ShieldCheck className="w-16 h-16 text-emerald-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Zona Seismică (ag)</p>
          <p className="text-3xl font-black text-slate-900">{data.seismicZone || '0.20g'}</p>
          <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-semibold">
            <ShieldCheck className="w-4 h-4" /> Normativ P100-1
          </div>
        </motion.div>

        {/* Card Fundație */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
             <Ruler className="w-16 h-16 text-blue-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Cota minimă Fundare</p>
          <p className="text-3xl font-black text-slate-900">-{data.minFoundationDepthCm || 90} cm</p>
          <div className="mt-4 flex items-center gap-2 text-blue-600 text-sm font-semibold">
            <Info className="w-4 h-4" /> Sub cota de îngheț
          </div>
        </motion.div>

        {/* Card Regim Inaltime */}
        <motion.div variants={itemVariants} className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-transform">
             <AlertTriangle className="w-16 h-16 text-amber-400" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Limită Regim Înălțime</p>
          <p className="text-3xl font-black text-amber-400">P + {maxFloors - 1}</p>
          <p className="text-sm text-slate-400 mt-2">Maxim {maxFloors} niveluri supraterane permise.</p>
        </motion.div>
      </div>

      {/* Banner avertizare CU — după grid-ul cu 3 carduri */}
<motion.div
  variants={itemVariants}
  className="bg-amber-50 border border-amber-200 rounded-2xl p-5"
>
  <div className="flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
    <div>
      <p className="font-semibold text-amber-800 text-sm">
        Limita afișată este tehnică națională
      </p>
      <p className="text-amber-700 text-sm mt-1">
        Normativele naționale permit maximum{' '}
        <strong>P+{data.maxAllowedFloors}</strong> pentru zona ta. 
        Primăria <strong>{data.locality}</strong>, județul{' '}
        <strong>{data.county}</strong> poate impune restricții 
        mai stricte prin PUG (Plan Urbanistic General).
      </p>
      <p className="text-amber-600 text-xs mt-2">
        Obține <strong>Certificatul de Urbanism</strong> înainte 
        de a demara proiectarea — termen legal 30 zile, 
        taxă 5-30 RON, temei Legea 50/1991.
      </p>
    </div>
  </div>
</motion.div>

      {/* AI Explanation Box with backdrop blur effects requested */}
      <motion.div 
        variants={itemVariants}
        className="bg-white/60 backdrop-blur-xl border border-slate-200 rounded-3xl p-8 relative overflow-hidden shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-slate-900 rounded-xl">
             <Brain className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Analiza Expertului Zidario (AI)</h3>
          {isAiLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        <div className="prose prose-slate max-w-none">
          <p className="text-slate-700 leading-relaxed min-h-[100px] whitespace-pre-wrap">
            {aiExplanation || (isAiLoading ? "Zidario analizează datele..." : "")}
          </p>
        </div>
        
        {/* Visual decoration */}
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-400/5 blur-3xl rounded-full" />
      </motion.div>
    </motion.div>
  );
};
