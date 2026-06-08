import { useState, useEffect } from 'react';
import type { BOMItem } from '../../hooks/useBOMData';
import { fetchWithAuth, apiPrivate } from '../../api/axios';

interface MaterialSideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentItem: BOMItem | null;
  projectId: string;
  onMaterialReplaced: () => void;
}

interface Alternative {
  id: number;
  internalCode: string;
  name: string;
  brand: string | null;
  pricePerUnit: number;
  unit: string;
  uValue: number | null;
}

export const MaterialSideDrawer = ({ isOpen, onClose, currentItem, projectId, onMaterialReplaced }: MaterialSideDrawerProps) => {
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(false);
  const [replacingCode, setReplacingCode] = useState<string | null>(null);
  
  // AI Stream state
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeAltCode, setActiveAltCode] = useState<string | null>(null);
  const [aiNoSources, setAiNoSources] = useState(false);

  useEffect(() => {
    if (isOpen && currentItem) {
      // @ts-ignore (material.internalCode) - it should exist in API output if we updated the BOM interface, but let's fetch it based on formulaKey mapping or pass internalCode
      // Actually BOMItem interface does not have internalCode exposed right now. I should modify BOMService to return internalCode.
      fetchAlternatives();
    }
  }, [isOpen, currentItem]);

  // Temporary function since we might not have internalCode in currentItem
  const fetchAlternatives = async () => {
    if (!currentItem) return;
    setLoading(true);
    try {
      // We need the internal code of the current material.
      // But we can get alternatives by querying all materials for now and filtering by category?
      // Wait! We added `GET /api/materials/:internalCode/alternatives`. Let's assume `currentItem.material.internalCode` exists.
      // If it doesn't, we will fix `bomService` to return it. Let's assume it does for now and fix backend next.
      const internalCode = (currentItem.material as any).internalCode;
      if (!internalCode) {
        console.error("internalCode missing on currentItem");
        setLoading(false);
        return;
      }
      const response = await apiPrivate.get(`/materials/${internalCode}/alternatives`);
      setAlternatives(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReplace = async (alt: Alternative) => {
    if (!currentItem) return;
    setReplacingCode(alt.internalCode);
    try {
      await apiPrivate.patch(`/bom/${projectId}/material`, {
        formulaKey: currentItem.formulaKey,
        newMaterialCode: alt.internalCode
      });
      onMaterialReplaced();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setReplacingCode(null);
    }
  };

  const explainWithAI = async (alt: Alternative) => {
    if (!currentItem) return;
    
    const currentName = currentItem.material.name;
    const prompt = `Salut Zidario! Te rog să compari "${currentName}" (materialul meu curent din deviz) cu varianta "${alt.name}".
Care sunt avantajele și dezavantajele pentru proiectul meu? E o alegere bună?`;

    // Trimite mesajul către chat-ul global
    window.dispatchEvent(new CustomEvent('zidario-ask', { detail: { message: prompt } }));
    
    // Închidem drawer-ul pentru a lăsa utilizatorul să vadă chat-ul
    onClose();
  };

  if (!isOpen || !currentItem) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Variante Alternative</h2>
            <p className="text-sm text-slate-500 mt-1">Compară și optimizează bugetul</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Baseline */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Material Curent</span>
            <p className="font-bold text-slate-900 mt-2">{currentItem.material.name}</p>
            <div className="flex justify-between items-end mt-4">
              <div className="text-sm text-slate-500">
                Cantitate: <span className="font-medium text-slate-700">{currentItem.quantity} {currentItem.material.unit}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Cost Etapă</span>
                <span className="font-bold text-slate-900 text-lg">
                  {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(currentItem.totalPrice)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="text-xl">✨</span> Alternative Disponibile
            </h3>
            
            {loading ? (
              <div className="text-center p-8 text-slate-500">Se caută alternative...</div>
            ) : alternatives.length === 0 ? (
              <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                Nu s-au găsit alternative pentru acest material.
              </div>
            ) : (
              alternatives.map(alt => {
                const altTotalPrice = currentItem.quantity * alt.pricePerUnit;
                const deltaCost = currentItem.totalPrice - altTotalPrice;
                const isCheaper = deltaCost > 0;
                
                // U Value logic
                const currentU = (currentItem.material as any).uValue || 0;
                const altU = alt.uValue || 0;
                let uComparison = "";
                if (currentU && altU) {
                  if (altU < currentU) uComparison = "Izolare termică mai bună";
                  else if (altU > currentU) uComparison = "Izolare termică mai slabă";
                  else uComparison = "Performanță termică similară";
                }

                return (
                  <div key={alt.id} className="border border-slate-200 hover:border-buildorange/50 transition-colors rounded-2xl p-5 flex flex-col gap-4">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-900">{alt.name}</h4>
                        {alt.brand && <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{alt.brand}</span>}
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        <div className={`p-3 rounded-xl ${isCheaper ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                          <span className="text-xs text-slate-500 block mb-1">Impact Financiar</span>
                          <span className={`font-bold ${isCheaper ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isCheaper ? 'Economisești: ' : 'Cost suplimentar: '}
                            {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(Math.abs(deltaCost))}
                          </span>
                        </div>
                        {currentU && altU ? (
                          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                            <span className="text-xs text-slate-500 block mb-1">Impact Energetic</span>
                            <span className="font-medium text-blue-700 text-sm">
                              {uComparison} <br/>(U: {altU} vs {currentU})
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>


                    <button 
                      onClick={() => explainWithAI(alt)}
                      className="text-left flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium w-max px-2 py-1 -ml-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      🤖 Întreabă Zidario (în chat): Pro și Contra
                    </button>

                    <button 
                      onClick={() => handleReplace(alt)}
                      disabled={replacingCode === alt.internalCode}
                      className={`mt-2 w-full font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 hover:bg-slate-800 text-white`}
                    >
                      {replacingCode === alt.internalCode
                        ? 'Se aplică...'
                        : 'Aplică această alternativă'
                      }
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
};
