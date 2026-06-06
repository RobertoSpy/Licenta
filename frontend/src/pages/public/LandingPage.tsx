import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  TrendingUp, 
  FileSpreadsheet, 
  ChevronRight, 
  AlertTriangle,
  Coins,
  CheckCircle,
  HelpCircle,
  Users
} from 'lucide-react';

export const LandingPage = () => {
  // Simulator interactiv pentru comisie/utilizator
  const [houseArea, setHouseArea] = useState(120);
  const [quality, setQuality] = useState<'standard' | 'premium'>('standard');

  const calculateEstimate = () => {
    // Estimare grosieră (ex: Standard = 650 EUR/mp, Premium = 900 EUR/mp la roșu/gri)
    const basePrice = quality === 'standard' ? 650 : 900;
    const total = houseArea * basePrice;
    
    // Distribuție materiale estimative
    const cement = Math.round(houseArea * 0.45 * (quality === 'standard' ? 1 : 1.2));
    const brick = Math.round(houseArea * 0.3 * (quality === 'standard' ? 1 : 1.1));
    const steel = Math.round(houseArea * 65 * (quality === 'standard' ? 1 : 1.3));

    return { total, cement, brick, steel };
  };

  const estimate = calculateEstimate();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-buildorange/20 selection:text-buildorange">
      
      {/* 1. HEADER (GLASSMORPHISM NAV) */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="bg-buildorange p-1.5 rounded-xl shadow-lg shadow-buildorange/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">
              Zidario<span className="text-buildorange">.ro</span>
            </span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <button onClick={() => scrollToSection('de-ce-noi')} className="hover:text-buildorange transition-colors">De ce noi?</button>
            <button onClick={() => scrollToSection('cum-functioneaza')} className="hover:text-buildorange transition-colors">Cum funcționează</button>
            <button onClick={() => scrollToSection('calculator-costuri')} className="hover:text-buildorange transition-colors">Simulator Costuri</button>
            <button onClick={() => scrollToSection('faq')} className="hover:text-buildorange transition-colors">Întrebări frecvente</button>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <Link 
              to="/login" 
              className="px-4 py-2 text-sm font-bold text-slate-700 hover:text-buildorange transition-colors"
            >
              Autentificare
            </Link>
            <Link 
              to="/register" 
              className="px-4 py-2 bg-buildorange text-white text-sm font-bold rounded-xl shadow-md shadow-buildorange/15 hover:bg-buildorange/95 hover:shadow-lg hover:shadow-buildorange/20 hover:-translate-y-0.5 transition-all duration-200"
            >
              Creează Cont Gratuit
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden py-20 lg:py-28 bg-gradient-to-b from-white via-slate-50 to-slate-100">
        {/* Background decorative grids */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-50/40 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-72 h-72 bg-buildorange/5 rounded-full filter blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          
          {/* Left Column: Text & Marketing hook */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100/70 border border-orange-200/50 text-orange-700 text-xs font-bold uppercase tracking-wider mb-6 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              Prima platformă cu AI din România
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
              Oprește <span className="text-buildorange relative inline-block">țepele<span className="absolute left-0 bottom-1.5 w-full h-2 bg-buildorange/10 -z-10 rounded"></span></span> și costurile ascunse în construcții.
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-2xl">
              Inflația accelerată și estimările „la ochi” ale meșterilor te lasă fără bani la mijlocul șantierului? 
              <strong className="text-slate-900 font-semibold"> Zidario</strong> folosește Inteligența Artificială pentru a-ți genera liste precise de materiale (BOM) și te pune în contact cu constructori verificați profesional. Construiește informat și în siguranță!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link 
                to="/register" 
                className="flex items-center justify-center gap-2 px-8 py-4 bg-buildorange text-white font-extrabold text-base rounded-xl shadow-lg shadow-buildorange/25 hover:bg-buildorange/95 hover:shadow-xl hover:shadow-buildorange/30 hover:-translate-y-0.5 transition-all duration-200 group"
              >
                Începe Proiectul Gratuit
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button 
                onClick={() => scrollToSection('calculator-costuri')}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-slate-700 font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                Simulează Costuri Casă
              </button>
            </div>

            {/* Micro proof/metrics */}
            <div className="mt-12 pt-8 border-t border-slate-200/60 grid grid-cols-3 gap-6 w-full max-w-lg">
              <div>
                <p className="text-3xl font-black text-slate-900">0 lei</p>
                <p className="text-xs text-slate-500 font-medium">Cont client de bază</p>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900">100%</p>
                <p className="text-xs text-slate-500 font-medium">Constructori cu CUI verificat</p>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900">AI</p>
                <p className="text-xs text-slate-500 font-medium">Devize optimizate instant</p>
              </div>
            </div>
          </div>

          {/* Right Column: Beautiful CSS Mockup of the Platform */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-[420px] lg:max-w-none bg-white rounded-2xl shadow-2xl shadow-slate-300/80 border border-slate-200/60 overflow-hidden transform lg:rotate-1 hover:rotate-0 transition-transform duration-500">
              
              {/* Header mockup toolbar */}
              <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 bg-red-400 rounded-full" />
                  <span className="w-3 h-3 bg-yellow-400 rounded-full" />
                  <span className="w-3 h-3 bg-green-400 rounded-full" />
                </div>
                <div className="bg-white border border-slate-200 text-[10px] text-slate-400 px-8 py-0.5 rounded-md select-none">
                  app.zidario.ro/dashboard
                </div>
                <div className="w-4" />
              </div>

              {/* Main content mockup */}
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Deviz Generat de AI</h5>
                    <p className="text-[10px] text-slate-400">Proiect: Casă P+1, 140mp</p>
                  </div>
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Aprobat Tehnic
                  </span>
                </div>

                {/* Materials mockup table */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-600">1. Ciment Holcim Structo (sac)</span>
                    <span className="font-bold text-slate-950">210 buc - 6.090 RON</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-buildorange h-full rounded-full" style={{ width: '85%' }} />
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-600">2. Cărămidă Porotherm 25</span>
                    <span className="font-bold text-slate-950">18 pale - 16.200 RON</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-buildorange h-full rounded-full" style={{ width: '60%' }} />
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-600">3. Oțel Beton BST500S (kg)</span>
                    <span className="font-bold text-slate-950">4.200 kg - 18.900 RON</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-buildorange h-full rounded-full" style={{ width: '70%' }} />
                  </div>
                </div>

                {/* AI recommendation alert */}
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3.5 flex gap-2">
                  <Sparkles className="w-4 h-4 text-buildorange shrink-0 mt-0.5" />
                  <div className="text-[11px] text-orange-900 leading-normal">
                    <strong className="font-bold">Recomandare AI:</strong> U-Value pereți exteriori este 0.22 W/m²K. Corespunde normativului MC001 pentru clădiri nZEB.
                  </div>
                </div>

                {/* Real market updates */}
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl text-[10px]">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    <span>Indice material Zidario</span>
                  </div>
                  <span className="text-red-500 font-bold">+2.4% (Luna trecută)</span>
                </div>
              </div>
            </div>
            
            {/* Decorative background circle */}
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-buildorange/15 rounded-xl -z-10 animate-spin" style={{ animationDuration: '20s' }} />
          </div>
        </div>
      </section>

      {/* 3. PAIN POINTS SECTION (DUREREA PIETEI) */}
      <section id="de-ce-noi" className="py-20 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-buildorange mb-3">Problema Reală în România</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              De ce eșuează 8 din 10 proiecte de construcții private?
            </p>
            <p className="mt-4 text-slate-500">
              Piața imobiliară din România ascunde capcane la tot pasul. Dacă nu ești informat, ajungi să plătești dublu sau să rămâi cu șantierul abandonat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Card 1: Tepari / Dorel */}
            <div className="bg-slate-50 border border-slate-200/80 p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">„Țepele” și lipsa contractelor</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Meșteri care solicită avansuri mari în cash, nu mai răspund la telefon sau lucrează fără proiect. În final, calitatea execuției este deplorabilă, iar tu nu ai nicio acoperire legală.
              </p>
            </div>

            {/* Card 2: Inflatie / Preturi ascunse */}
            <div className="bg-slate-50 border border-slate-200/80 p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6">
                <Coins className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Devize modificate din mers</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Ți se oferă inițial un preț mic pentru a semna contractul, urmând ca pe parcurs să apară „cheltuieli neprevăzute” sau scumpiri masive de materiale pe care ești forțat să le accepți.
              </p>
            </div>

            {/* Card 3: Oameni neinformati / Lipsa Control tehnic */}
            <div className="bg-slate-50 border border-slate-200/80 p-8 rounded-2xl relative overflow-hidden group">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Calculul „la ochi” al materialelor</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Fără un necesar exact de materiale (BOM), constructorul comandă în exces sau la prețuri mult peste media pieței. Rămâi cu pierderi sau plătești adaosuri comerciale uriașe.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. SOLUTIA ZIDARIO (FEATURES GRID) */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-buildorange mb-3">Soluția Zidario</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Construiește inteligent, cu bugetul sub control absolut
            </p>
            <p className="mt-4 text-slate-500">
              Am integrat AI și date de piață actualizate zilnic pentru a-ți oferi controlul total asupra propriului șantier.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Feature 1 */}
            <div className="flex gap-5 bg-white border border-slate-200/60 p-6 rounded-2xl shadow-sm">
              <div className="w-12 h-12 bg-buildorange/10 text-buildorange rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Estimator AI & nZEB Compliance</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Introduci datele casei sau schița 2D, iar motorul nostru AI calculează necesarul brut de materiale. Mai mult, sistemul verifică dacă proiectul tău respectă normele europene de eficiență energetică (nZEB).
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-5 bg-white border border-slate-200/60 p-6 rounded-2xl shadow-sm">
              <div className="w-12 h-12 bg-buildorange/10 text-buildorange rounded-xl flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Deviz Complet de Materiale (BOM)</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Descarcă șabloane de import CSV sau editează direct în platformă cantitățile necesare de ciment, cărămidă, fier și lemn. Ești mereu pregătit când discuți cu furnizorii de materiale.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-5 bg-white border border-slate-200/60 p-6 rounded-2xl shadow-sm">
              <div className="w-12 h-12 bg-buildorange/10 text-buildorange rounded-xl flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Constructori Verificați</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Nu mai angaja pe oricine. Constructorii înscriși în marketplace trec printr-un proces riguros de verificare: companie înregistrată (CUI activ), portofoliu real de lucrări și recenzii de la clienți anteriori.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-5 bg-white border border-slate-200/60 p-6 rounded-2xl shadow-sm">
              <div className="w-12 h-12 bg-buildorange/10 text-buildorange rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Monitorizarea Prețurilor Pieței</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Compară prețul oferit de furnizorii tăi cu indicii de preț mediu național colectați automat din piață de către Zidario, corelați cu statisticile INSSE. Astfel știi instant dacă ești păcălit.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. CUM FUNCTIONEAZA */}
      <section id="cum-functioneaza" className="py-20 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-buildorange mb-3">Pașii Tăi Către Succes</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Cum funcționează Zidario?
            </p>
            <p className="mt-4 text-slate-500">
              În doar 3 pași simpli preiei controlul total asupra costurilor tale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 bg-slate-100 text-slate-800 border-2 border-slate-200 rounded-2xl flex items-center justify-center font-black text-xl mb-6 shadow-sm">
                1
              </div>
              <h4 className="font-bold text-slate-900 text-lg mb-2">Înregistrează-te și creează Proiectul</h4>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
                Îți configurezi profilul și adaugi datele inițiale ale casei pe care dorești să o construiești sau să o renovezi.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 bg-buildorange/10 text-buildorange border-2 border-buildorange/20 rounded-2xl flex items-center justify-center font-black text-xl mb-6 shadow-sm">
                2
              </div>
              <h4 className="font-bold text-slate-900 text-lg mb-2">Generează Devizul AI</h4>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
                Asistentul nostru AI analizează datele și schițele pentru a-ți livra necesarul de materiale, gata de utilizat pentru oferte.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 bg-slate-100 text-slate-800 border-2 border-slate-200 rounded-2xl flex items-center justify-center font-black text-xl mb-6 shadow-sm">
                3
              </div>
              <h4 className="font-bold text-slate-900 text-lg mb-2">Conectează-te cu Constructori</h4>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
                Trimite devizul către constructorii parteneri din platformă și primește oferte direct în cont, fără telefoane și costuri ascunse.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. INTERACTIVE ESTIMATOR SIMULATOR (SIMULATOR COSTURI) */}
      <section id="calculator-costuri" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Col - Simulator Controls */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-buildorange bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                  Simulator interactiv
                </span>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight mt-4">
                  Cât te costă structura casei tale?
                </h3>
                <p className="text-slate-500 text-sm mt-2">
                  Alege suprafața utilă dorită și tipul de finisaj/materiale pentru a genera o estimare grosieră la roșu.
                </p>
              </div>

              {/* Range Slider for area */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <label className="font-bold text-slate-800">Suprafață construită desfășurată:</label>
                  <span className="font-black text-buildorange text-lg bg-orange-50 px-3 py-1 rounded-lg border border-orange-100">
                    {houseArea} m²
                  </span>
                </div>
                <input 
                  type="range" 
                  min="60" 
                  max="300" 
                  step="10"
                  value={houseArea}
                  onChange={(e) => setHouseArea(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-buildorange"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>60 m² (Mică)</span>
                  <span>180 m² (Medie)</span>
                  <span>300 m² (Mare)</span>
                </div>
              </div>

              {/* Segmented control for quality */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800 block">Nivelul materialelor și finisajelor:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setQuality('standard')}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all text-center ${
                      quality === 'standard' 
                        ? 'border-buildorange bg-orange-50/50 text-buildorange' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    Standard (Clasic)
                  </button>
                  <button
                    onClick={() => setQuality('premium')}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all text-center ${
                      quality === 'premium' 
                        ? 'border-buildorange bg-orange-50/50 text-buildorange' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    Premium (nZEB / Eficient)
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  *Această estimare are caracter orientativ și simulează un cost mediu național pentru materialele la roșu + manoperă medie. Pentru un deviz complet de precizie, înregistrează-te și folosește corelarea exactă cu standardele românești.
                </p>
              </div>
            </div>

            {/* Right Col - Live Calculation Output */}
            <div className="lg:col-span-6 bg-slate-950 text-white rounded-2xl p-8 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-buildorange/10 rounded-full filter blur-2xl pointer-events-none" />
              
              <div className="pb-4 border-b border-white/10">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Cost estimat proiect</p>
                <h4 className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-1">
                  ~ {estimate.total.toLocaleString('ro-RO')} <span className="text-buildorange">EUR</span>
                </h4>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-3">Necesar estimat materiale brute:</p>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                    <span className="text-slate-300">Ciment necesar (saci 40kg)</span>
                    <span className="font-bold text-white">{estimate.cement} saci</span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                    <span className="text-slate-300">Cărămidă portantă (palet)</span>
                    <span className="font-bold text-white">{estimate.brick} pale</span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                    <span className="text-slate-300">Oțel beton (armături)</span>
                    <span className="font-bold text-white">{estimate.steel.toLocaleString('ro-RO')} kg</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  to="/register"
                  className="w-full flex items-center justify-center gap-2 py-4 bg-buildorange text-white font-extrabold rounded-xl shadow-lg hover:bg-buildorange/90 transition-colors"
                >
                  Generează devizul complet în aplicație
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. FAQ SECTION */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-buildorange mb-3">Lămuriri Rapide</h2>
            <p className="text-3xl font-black text-slate-900">Întrebări Frecvente</p>
          </div>

          <div className="space-y-6">
            {[
              {
                q: 'Este Zidario gratuit pentru persoanele care vor să își construiască o casă?',
                a: 'Da! Serviciile de configurare proiect, generare devize AI, calcul BOM și solicitare oferte de la constructori sunt complet gratuite pentru clienți în versiunea curentă.'
              },
              {
                q: 'De unde sunt colectate prețurile materialelor de construcție?',
                a: 'Zidario monitorizează prețurile de la marii retaileri de materiale de construcții din România, procesează datele de achiziții publice și le corelează cu indicii lunari de cost publicați de Institutul Național de Statistică (INSSE).'
              },
              {
                q: 'Cum este asigurată seriozitatea constructorilor în marketplace?',
                a: 'Fiecare constructor care dorește să trimită oferte în marketplace trebuie să trimită documente doveditoare (CUI, certificat constatator). Recenziile sunt permise doar utilizatorilor care au acceptat oferte oficiale prin intermediul platformei, evitând recenziile false.'
              },
              {
                q: 'Ce înseamnă nZEB și cum mă ajută AI-ul din platformă?',
                a: 'nZEB (nearly Zero-Energy Building) reprezintă standardul obligatoriu în UE pentru clădirile noi (consum de energie aproape de zero). Asistentul AI din Zidario analizează automat materialele alese (exemplu: grosimea polistirenului, tipul de cărămidă) pentru a-ți spune dacă proiectul tău atinge standardele legale de izolare termică.'
              }
            ].map((item, idx) => (
              <div key={idx} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-sm transition-shadow">
                <h4 className="font-bold text-slate-900 flex gap-2 items-center text-base">
                  <HelpCircle className="w-5 h-5 text-buildorange shrink-0" />
                  {item.q}
                </h4>
                <p className="mt-3 text-slate-600 text-sm leading-relaxed pl-7">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FINAL CALL TO ACTION (CTA) */}
      <section className="py-20 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-buildorange/10 rounded-full filter blur-3xl pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-8">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Ești gata să îți protejezi banii și șantierul?
          </h2>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            Creează-ți un cont gratuit chiar acum. Obține estimările exacte de materiale, află normele legale și colaborează exclusiv cu constructori autorizați.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              to="/register" 
              className="px-8 py-4 bg-buildorange text-white font-extrabold rounded-xl shadow-lg shadow-buildorange/20 hover:bg-buildorange/90 transition-all hover:scale-105"
            >
              Creează Contul Meu
            </Link>
            <Link 
              to="/login" 
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold border border-white/10 rounded-xl transition-all"
            >
              Intră în cont
            </Link>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-12 text-sm">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-8">
          
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-buildorange p-1 rounded-lg">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white text-base">Zidario</span>
            </div>
            <p className="max-w-sm text-slate-500 leading-relaxed text-xs">
              Prima platformă inteligentă din România pentru planificarea, auditarea nZEB și protecția financiară a proprietarilor în relația cu constructorii.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h5 className="text-white font-semibold text-xs uppercase tracking-wider">Link-uri Juridice</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/terms" className="hover:text-buildorange transition-colors">Termeni și Condiții</Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-buildorange transition-colors">Politica de Confidențialitate (GDPR)</Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h5 className="text-white font-semibold text-xs uppercase tracking-wider">Contact & Suport</h5>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>Email: <strong className="text-slate-300">contact@zidario.ro</strong></li>
              <li>Adresă: București, România</li>
              <li>Proiect realizat pentru susținerea examenului de licență 2026.</li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-6 mt-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Zidario.ro. Toate drepturile rezervate.</p>
          <div className="flex gap-4">
            <span>Powered by AI & BuildWise Engine</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
