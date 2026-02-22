import { TrendingUp, BarChart3, Clock, AlertCircle } from 'lucide-react';

export const MarketAnalysis = () => {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analiza Pieței</h1>
        <p className="text-slate-500 mt-1">Estimări și tendințe ale prețurilor în construcții din ultimii 20 de ani.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-buildnavy to-slate-900 rounded-2xl p-6 text-white shadow-lg lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-lg">Indicele Costului de Construcție</h3>
            </div>
            <p className="text-slate-300 mb-6 max-w-lg">
              Tendința actuală indică o ușoară stabilizare a prețurilor la beton și oțel fasonat. Este un moment optim pentru a achiziționa materiale structurale.
            </p>
            <div className="flex items-end gap-4">
              <div className="text-4xl font-black">€450</div>
              <div className="text-slate-400 font-medium pb-1">/ m² (preț mediu la roșu)</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900">Concluzia Expertului</h3>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            Întârzierea cu 6 luni a proiectului ar putea crește costul total cu aproximativ 5-7% pe baza inflației materialelor de finisaj din prezent.
          </p>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 flex gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-xs font-medium text-amber-800">Cumpără materialele esențiale la începutul proiectului pentru a fixa prețul.</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm h-96 flex flex-col items-center justify-center text-center">
        {/* Placeholder for actual chart */}
        <BarChart3 className="w-16 h-16 text-slate-200 mb-4" />
        <h3 className="text-lg font-bold text-slate-400 mb-2">Grafic Evoluție Prețuri Materiale (2004 - 2024)</h3>
        <p className="text-slate-400 text-sm max-w-sm">
          Integrarea completă a graficului interactiv Recharta va fi adăugată pentru o vizualizare detaliată a trendurilor macro-economice.
        </p>
      </div>
    </div>
  );
};
