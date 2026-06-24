// frontend/src/components/editor/AiRoomSuggestModal.tsx
//
// Modal care colectează date de la utilizator (nr. persoane + buget),
// apelează /api/ai/suggest-rooms și afișează sugestia AI cu motivare per cameră.
// La confirmare, injectează rooms[] direct în store-ul Zustand → Slice-and-Dice rulează automat.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, X, Users, Wallet, ChevronRight,
  Brain, CheckCircle2, AlertCircle, Loader2,
  Info, Home, Lightbulb, Square, LayoutTemplate
} from 'lucide-react';
import { aiApi, type RoomSuggestion, type BudgetCategory } from '../../api/aiApi';
import { useEditorState } from '../../hooks/useEditorState';
import { editorApi, type FloorKey } from '../../api/editorApi';
import LAYOUT_CONSTANTS from '../../data/layout-constants.json';

interface Props {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  projectData: Record<string, unknown> | null;
}

const BUDGET_OPTIONS: { value: BudgetCategory; label: string; desc: string; color: string }[] = [
  { value: 'economic', label: 'Economic', desc: 'Camere esențiale, suprafețe minime', color: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { value: 'mediu', label: 'Normal', desc: 'Confort bun, spații generoase', color: 'border-blue-300 bg-blue-50 text-blue-800' },
];

const ZONE_COLORS: Record<string, string> = {
  distributie: 'bg-slate-100 text-slate-700 border-slate-200',
  zi: 'bg-orange-50 text-orange-800 border-orange-200',
  noapte: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  tehnic: 'bg-gray-50 text-gray-700 border-gray-200',
};

const ZONE_LABELS: Record<string, string> = {
  distributie: 'Distribuție',
  zi: 'Zona Zi',
  noapte: 'Zona Noapte',
  tehnic: 'Tehnic',
};

// Step 1 — colectare date
// Step 2 — loading AI
// Step 3 — preview rezultat
type Step = 'input' | 'loading' | 'result';

export const AiRoomSuggestModal: React.FC<Props> = ({ projectId, isOpen, onClose, projectData }) => {
  const [step, setStep] = useState<Step>('input');

  // Dynamic slider: POT legal 40% per etaj din teren (dacă avem date)
  const plotArea = Number(projectData?.plotAreaSqm ?? 500);
  const totalFloors = Number(projectData?.totalFloors ?? 1);
  const maxHouseArea = Math.min(Math.round(plotArea * 0.40 * totalFloors), 1200);
  const defaultHouseArea = Math.min(120, maxHouseArea);

  const [houseAreaSqm, setHouseAreaSqm] = useState(defaultHouseArea);
  const [familySize, setFamilySize] = useState(3);
  const [budget, setBudget] = useState<BudgetCategory>('mediu');
  const [suggestion, setSuggestion] = useState<RoomSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSavingFloors, setIsSavingFloors] = useState(false);
  const [refinementText, setRefinementText] = useState('');

  const { setActiveRooms, houseShape, setHouseShape, dimensions, setDimensions, switchFloor, streetOrientation } = useEditorState();

  const handleGenerate = async () => {
    setStep('loading');
    setError(null);
    setRefinementText('');
    try {
      const result = await aiApi.suggestRooms(projectId, familySize, budget, houseAreaSqm, totalFloors);
      setSuggestion(result);
      setStep('result');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e.message ?? 'Eroare necunoscută.');
      setStep('input');
    }
  };

  const handleRefine = async () => {
    if (!refinementText.trim() || !suggestion) return;
    setStep('loading');
    setError(null);
    try {
      const result = await aiApi.suggestRooms(projectId, familySize, budget, houseAreaSqm, totalFloors, refinementText, suggestion.rooms);
      setSuggestion(result);
      setStep('result');
      setRefinementText('');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e.message ?? 'Eroare necunoscută.');
      setStep('result'); // back to result to see previous rooms
    }
  };

  const handleApply = async () => {
    if (!suggestion) return;
    setIsSavingFloors(true);

    // Grupăm camerele AI pe etaje
    const FLOOR_ORDER = LAYOUT_CONSTANTS.floors.map(f => f.key as FloorKey);
    const byFloor: Record<string, typeof suggestion.rooms> = {};
    for (const room of suggestion.rooms) {
      const f = room.floor ?? 'parter';
      if (!byFloor[f]) byFloor[f] = [];
      byFloor[f].push(room);
    }
    // Eliminat fallback-ul periculos care duplica camerele pe parter.
    // Camerele primesc etaj by default in l. 89: const f = room.floor ?? 'parter';

    // FIX — Problema 1 & 2: Calculăm dimensiunile corecte ale amprentei per etaj.
    // Ne bazăm strict pe suprafața estimată de AI împărțită la numărul de etaje distincte.
    const floorsCount = Object.keys(byFloor).length || 1;
    const sqmPerFloor = houseAreaSqm / floorsCount;

    const shapeMultiplier = LAYOUT_CONSTANTS.shape_multipliers[houseShape as keyof typeof LAYOUT_CONSTANTS.shape_multipliers] || 1;

    const autoWidthM = Math.sqrt(sqmPerFloor * (4 / 3) * shapeMultiplier);
    const autoHeightM = (sqmPerFloor * shapeMultiplier) / autoWidthM;

    const finalWidthM = Math.round(autoWidthM * 10) / 10;
    const finalHeightM = Math.round(autoHeightM * 10) / 10;

    const dims = {
      widthM: finalWidthM,
      heightM: finalHeightM,
      wingWidthM: Math.round(finalWidthM / 2.5),
      wingLengthM: Math.round(finalHeightM / 2),
    };

    // Salvăm noile dimensiuni pentru calcul, dar NU apelăm setDimensions încă.
    // Dacă am apela setDimensions aici, am scala inutil elementele vechi de pe canvas,
    // înainte ca backend-ul să genereze noile elemente.
    // setDimensions(dims); // ELIMINAT pentru a preveni scalarea eronată a vechiului plan
    try {
      // Folosește cache-ul în loc să regenerezi
      let parterElementsCache: any[] | null = null;
      let parterConfigRoomsCache: any[] | null = null;


      // Generăm și salvăm fiecare etaj în ordine
      for (const floorKey of FLOOR_ORDER) {
        const floorRooms = byFloor[floorKey];
        if (!floorRooms || floorRooms.length === 0) continue;

        // ── SUBSOL: se salvează în DB pentru BOM (coeficient 0.50 per Indicii cost INSSE) ──
        // dar NU se generează plan 2D. Subsolul nu este nivel locuibil, nu are aceeași
        // amprentă desenabilă în editor și nu intră în suprafața utilă (Legea 114/1996).
        if (floorKey === 'subsol') {
          const basementState = {
            elements: [],  // fără elemente canvas
            activeRooms: floorRooms.map((r, i) => ({ id: `ai-subsol-${i}`, ...r })),
            dimensions: { widthM: 0, heightM: 0, wingWidthM: 0, wingLengthM: 0 },
            houseShape,
            streetOrientation,
          };
          await editorApi.saveFloor(projectId, floorKey, basementState as any, 'AI — subsol (BOM only)');
          continue; // skip 2D generation
        }

        // FIX: Calculăm suprafața corectă PER ETAJ, nu împărțim totalul la numărul de etaje.
        // Fiecare etaj are propria sa amprentă la sol, nu partajează aceeași suprafață.

        // Folosim dimensiunile globale unificate pentru toate etajele.
        // Asta garantează că amprenta casei este uniformă (aceeași și la parter și la etaj)
        // și că se respectă suprafața totală estimată de AI.
        const floorDims = { ...dims };

        // Nu mai apelăm setDimensions aici! 
        // Vom aplica dimensiunile direct în switchFloor la final, împreună cu elementele generate,
        // pentru a păstra reactivitatea Zustand o singură dată pe tot arborele.

        const configRooms = floorRooms.map((r, i) => ({
          id: `ai-${floorKey}-${i}`,
          type: r.type,
          label: r.label,
          zone: r.zone ?? 'zi',
          ratioValue: r.weightRatio,
          // ── Proprietăți critice pentru generarea ferestrelor și ușilor ──
          naturalLight: r.naturalLight ?? false,
          hasDoorTo: r.hasDoorTo ?? [],
          isCirculation: r.isCirculation ?? false,
          hasStaircase: r.hasStaircase ?? false,
          orientation: r.orientation ?? [],
          minSqm: r.minSqm ?? undefined,
          maxSqm: r.maxSqm ?? undefined,
          mustAdjacentTo: r.mustAdjacentTo ?? [],
        }));

        const floorElements = await editorApi.generateConfiguratorLayout(projectId, houseShape, floorDims, configRooms, streetOrientation);

        const fullState = {
          elements: floorElements,
          activeRooms: configRooms,
          dimensions: floorDims,
          houseShape: houseShape,
          streetOrientation: streetOrientation
        };

        if (floorKey === 'parter') {
          parterElementsCache = floorElements;
          parterConfigRoomsCache = configRooms;
        }

        await editorApi.saveFloor(projectId, floorKey, fullState as any, `AI — ${floorKey}`);
      }

      if (parterElementsCache && parterConfigRoomsCache) {
        // Folosim direct dimensiunile globale 'dims' calculate corect din total
        // pentru a preveni deviațiile (când suma minimelor camerelor nu dă exact suprafața target).
        const parterDims = { ...dims };
        switchFloor('parter', {
          elements: parterElementsCache,
          activeRooms: parterConfigRoomsCache,
          dimensions: parterDims,
          houseShape,
          streetOrientation,
        });
      }

      onClose();
    } catch (e: any) {
      setError('Eroare la salvarea planului. Încearcă din nou.');
    } finally {
      setIsSavingFloors(false);
    }
  };

  const handleReset = () => {
    setStep('input');
    setSuggestion(null);
    setError(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-lg bg-white rounded-3xl shadow-2xl shadow-black/20 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-base leading-tight">
                      Sugestie AI Program Funcțional
                    </h2>
                    <p className="text-violet-200 text-xs">
                      Bazat pe NP 057/2002 și Legea 114/1996
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">

                {/* ── STEP: INPUT ── */}
                {step === 'input' && (
                  <div className="space-y-5">

                    {/* Error */}
                    {error && (
                      <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl p-3.5 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Info box */}
                    <div className="flex items-start gap-2.5 bg-violet-50 border border-violet-100 rounded-2xl p-3.5">
                      <Brain className="w-4 h-4 shrink-0 mt-0.5 text-violet-500" />
                      <p className="text-xs text-violet-700 leading-relaxed">
                        AI-ul va analiza suprafața dorită, stilul casei și orientarea față de stradă
                        din Faza 1 și va genera lista optimă de camere cu dimensiunile recomandate.
                      </p>
                    </div>

                    {/* House Area */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <Square className="w-3.5 h-3.5" /> Suprafața Dorită Casă (m²)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="40"
                          max={maxHouseArea}
                          step="5"
                          value={houseAreaSqm}
                          onChange={e => setHouseAreaSqm(parseInt(e.target.value, 10))}
                          className="flex-1 accent-violet-600"
                        />
                        <div className="w-16 text-right">
                          <span className="text-xl font-black text-slate-800">{houseAreaSqm}</span>
                          <span className="text-xs text-slate-400 ml-0.5">m²</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 text-center">
                        Max legal: <span className="font-bold text-violet-600">{maxHouseArea} m²</span> (POT 40% × {totalFloors} nivel{totalFloors > 1 ? 'e' : ''} din {plotArea} m² teren)
                      </p>
                    </div>

                    {/* Family size */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5" /> Număr persoane în familie
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setFamilySize(v => Math.max(1, v - 1))}
                          className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg transition-colors flex items-center justify-center"
                        >
                          −
                        </button>
                        <div className="flex-1 text-center">
                          <span className="text-3xl font-black text-slate-800">{familySize}</span>
                          <span className="text-sm text-slate-400 ml-1.5">
                            {familySize === 1 ? 'persoană' : 'persoane'}
                          </span>
                        </div>
                        <button
                          onClick={() => setFamilySize(v => Math.min(10, v + 1))}
                          className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg transition-colors flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 text-center">
                        Minim {Math.max(1, Math.ceil(familySize / 2))} dormitor(e) necesar(e)
                      </p>
                    </div>

                    {/* Budget */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <Wallet className="w-3.5 h-3.5" /> Categorie buget
                      </label>
                      <div className="space-y-2">
                        {BUDGET_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setBudget(opt.value)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${budget === opt.value
                                ? opt.color + ' border-2'
                                : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-600'
                              }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${budget === opt.value ? 'border-current' : 'border-slate-300'
                              }`}>
                              {budget === opt.value && (
                                <div className="w-2 h-2 rounded-full bg-current" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-bold">{opt.label}</div>
                              <div className="text-[11px] opacity-75">{opt.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Shape Selector */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <LayoutTemplate className="w-3.5 h-3.5" /> Forma Casei
                      </label>
                      <select
                        value={houseShape}
                        onChange={(e) => setHouseShape(e.target.value as any)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all cursor-pointer"
                      >
                        {LAYOUT_CONSTANTS.shapes.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={handleGenerate}
                      className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generează cu AI
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* ── STEP: LOADING ── */}
                {step === 'loading' && (
                  <div className="py-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-200">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-bold text-slate-800">Zidario analizează...</p>
                      <p className="text-xs text-slate-400">
                        Consultă NP 057/2002, Legea 114/1996 și datele proiectului tău
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-indigo-400"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── STEP: RESULT ── */}
                {step === 'result' && suggestion && (
                  <div className="space-y-4">

                    {/* Summary bar */}
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-800">
                          {suggestion.rooms.length} camere recomandate
                        </p>
                        <p className="text-xs text-emerald-600">
                          ~{suggestion.totalEstimatedSqm} mp estimat total util
                        </p>
                      </div>
                    </div>

                    {/* Insufficient Area Warning */}
                    {(() => {
                      const totalMinSqm = suggestion.rooms.reduce((s, r) => s + (r.minSqm ?? 0), 0);
                      // Daca minimele absolute depasesc suprafata dorita
                      if (totalMinSqm > houseAreaSqm) {
                        return (
                          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-red-800">
                                Suprafață insuficientă (sub minimul legal)
                              </p>
                              <p className="text-xs text-red-600 mt-1 leading-relaxed">
                                Suprafața cerută de {houseAreaSqm} m² este prea mică pentru acest program funcțional. 
                                Suma suprafețelor minime legale impuse de Legea 114/1996 este de minim <strong>{Math.round(totalMinSqm)} m²</strong>. 
                                Dacă continui, algoritmul va încălca normativul și va scala forțat camerele sub pragul legal pentru a le face să încapă.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Layout advice */}
                    {suggestion.layoutAdvice && (
                      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">{suggestion.layoutAdvice}</p>
                      </div>
                    )}

                    {/* Rooms list */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {suggestion.rooms.map((room, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-3.5 py-3 bg-slate-50 rounded-2xl border border-slate-100"
                        >
                          <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            <Home className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-800">{room.label}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ZONE_COLORS[room.zone] ?? ZONE_COLORS.tehnic}`}>
                                {ZONE_LABELS[room.zone] ?? room.zone}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                ×{room.weightRatio.toFixed(1)}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                {room.floor ?? 'parter'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                              {room.reasoning}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Normative note */}
                    {suggestion.normativeNote && (
                      <div className="flex items-start gap-2 text-[10px] text-slate-400">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{suggestion.normativeNote}</span>
                      </div>
                    )}

                    {/* Refinement Area */}
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-800 mb-2">
                        Vrei să schimbi ceva? Spune-i lui Zidario:
                      </p>
                      <textarea
                        value={refinementText}
                        onChange={(e) => setRefinementText(e.target.value)}
                        placeholder="ex: 'Vreau bucătăria închisă, nu open-space' sau 'Biroul să fie mai mic, de doar 9 mp'"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all resize-none h-20"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={refinementText.trim() ? handleRefine : handleReset}
                        disabled={isSavingFloors}
                        className="flex-1 py-3 px-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-40"
                      >
                        {refinementText.trim() ? '← Ajustează' : '← Regenerează'}
                      </button>
                      <button
                        onClick={handleApply}
                        disabled={isSavingFloors}
                        className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-60"
                      >
                        {isSavingFloors ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generez etajele...
                          </span>
                        ) : (
                          `Aplică Planul ✓${totalFloors > 1 ? ` (${totalFloors} etaje)` : ''}`
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
