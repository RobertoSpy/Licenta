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
  Info, Home, Lightbulb, Square
} from 'lucide-react';
import { aiApi, type RoomSuggestion, type BudgetCategory } from '../../api/aiApi';
import { useEditorState } from '../../hooks/useEditorState';
import { editorApi, type FloorKey } from '../../api/editorApi';
import { generateConfiguratorLayout } from '../../utils/layoutPartitioner';

interface Props {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  projectData: Record<string, unknown> | null;
}

const BUDGET_OPTIONS: { value: BudgetCategory; label: string; desc: string; color: string }[] = [
  { value: 'economic', label: 'Economic',  desc: 'Camere esențiale, suprafețe minime', color: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { value: 'mediu',    label: 'Mediu',      desc: 'Confort bun, spații generoase',       color: 'border-blue-300 bg-blue-50 text-blue-800'         },
  { value: 'premium',  label: 'Premium',    desc: 'Birou, dressing, sală de mese',       color: 'border-purple-300 bg-purple-50 text-purple-800'   },
];

const ZONE_COLORS: Record<string, string> = {
  distributie: 'bg-slate-100 text-slate-700 border-slate-200',
  zi:          'bg-orange-50 text-orange-800 border-orange-200',
  noapte:      'bg-indigo-50 text-indigo-800 border-indigo-200',
  tehnic:      'bg-gray-50 text-gray-700 border-gray-200',
};

const ZONE_LABELS: Record<string, string> = {
  distributie: 'Distribuție',
  zi:          'Zona Zi',
  noapte:      'Zona Noapte',
  tehnic:      'Tehnic',
};

// Step 1 — colectare date
// Step 2 — loading AI
// Step 3 — preview rezultat
type Step = 'input' | 'loading' | 'result';

export const AiRoomSuggestModal: React.FC<Props> = ({ projectId, isOpen, onClose, projectData }) => {
  const [step, setStep]               = useState<Step>('input');

  // Dynamic slider: POT legal 40% per etaj din teren (dacă avem date)
  const plotArea    = Number(projectData?.plotAreaSqm ?? 500);
  const totalFloors = Number(projectData?.totalFloors ?? 1);
  const maxHouseArea = Math.min(Math.round(plotArea * 0.40 * totalFloors), 1200);
  const defaultHouseArea = Math.min(120, maxHouseArea);

  const [houseAreaSqm, setHouseAreaSqm] = useState(defaultHouseArea);
  const [familySize, setFamilySize]   = useState(3);
  const [budget, setBudget]           = useState<BudgetCategory>('mediu');
  const [suggestion, setSuggestion]   = useState<RoomSuggestion | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [isSavingFloors, setIsSavingFloors] = useState(false);

  const { setActiveRooms, setDimensions, houseShape, switchFloor, streetOrientation } = useEditorState();

  const handleGenerate = async () => {
    setStep('loading');
    setError(null);
    try {
      const result = await aiApi.suggestRooms(projectId, familySize, budget, houseAreaSqm);
      setSuggestion(result);
      setStep('result');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e.message ?? 'Eroare necunoscută.');
      setStep('input');
    }
  };

  const handleApply = async () => {
    if (!suggestion) return;
    setIsSavingFloors(true);
    
    // Bounding Box Math logic — per etaj
    const A = houseAreaSqm / totalFloors; // suprafață pe un nivel
    let W = 10;
    let H = 10;

    if (houseShape === 'rectangle') {
      H = Math.sqrt(A / 1.3);
      W = H * 1.3;
    } else if (houseShape === 'l_shape') {
      W = Math.sqrt(A / 0.75);
      H = Math.sqrt(A / 0.75);
    } else if (houseShape === 'u_shape') {
      H = Math.sqrt(A / (0.65 * 1.3));
      W = H * 1.3;
    } else if (houseShape === 't_shape') {
      W = Math.sqrt(A / 0.70);
      H = Math.sqrt(A / 0.70);
    } else {
      W = Math.sqrt(A);
      H = Math.sqrt(A);
    }

    const finalW = Math.round(W * 10) / 10;
    const finalH = Math.round(H * 10) / 10;
    setDimensions({ widthM: finalW, heightM: finalH });

    // Grupăm camerele pe etaje
    const FLOOR_ORDER: FloorKey[] = ['parter', 'etaj1', 'etaj2', 'mansarda'];
    const byFloor: Record<string, typeof suggestion.rooms> = {};
    for (const room of suggestion.rooms) {
      const f = room.floor ?? 'parter';
      if (!byFloor[f]) byFloor[f] = [];
      byFloor[f].push(room);
    }

    // Asigurăm că parterul are mereu camere (fallback)
    if (!byFloor['parter'] || byFloor['parter'].length === 0) {
      byFloor['parter'] = suggestion.rooms;
    }

    const dims = { widthM: finalW, heightM: finalH, wingWidthM: Math.round(finalW / 2.5), wingLengthM: Math.round(finalH / 2) };

    try {
      // Generăm și salvăm fiecare etaj în ordine
      for (const floorKey of FLOOR_ORDER) {
        const floorRooms = byFloor[floorKey];
        if (!floorRooms || floorRooms.length === 0) continue;

        const configRooms = floorRooms.map((r, i) => ({
          id: `ai-${floorKey}-${i}`,
          label: r.label,
          ratioValue: r.weightRatio,
        }));

        const floorElements = generateConfiguratorLayout(houseShape, dims, configRooms, streetOrientation);
        await editorApi.saveFloor(projectId, floorKey, floorElements, `AI — ${floorKey}`);
      }

      // Activate parter rooms in zustand + switch canvas
      const parterRooms = byFloor['parter'].map(r => ({
        type: r.type,
        label: r.label,
        weightRatio: r.weightRatio,
      }));
      const parterConfigRooms = parterRooms.map((r, i) => ({ id: `ai-parter-${i}`, label: r.label, ratioValue: r.weightRatio }));
      const parterElements = generateConfiguratorLayout(houseShape, dims, parterConfigRooms, streetOrientation);
      switchFloor('parter', parterElements);
      setActiveRooms(parterRooms);

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
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                              budget === opt.value
                                ? opt.color + ' border-2'
                                : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              budget === opt.value ? 'border-current' : 'border-slate-300'
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

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={handleReset}
                        disabled={isSavingFloors}
                        className="flex-1 py-3 px-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-40"
                      >
                        ← Regenerează
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
