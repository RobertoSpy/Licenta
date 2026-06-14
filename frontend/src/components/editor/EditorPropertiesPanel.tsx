import React, { useState, useEffect } from 'react';
import { useEditorState, pxToMeters } from '../../hooks/useEditorState';
import { type ConformityRoom, type ConformityRuleIssue } from '../../hooks/useConformityCheck';
import { Trash2, Tag, Scale, Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LAYOUT_CONSTANTS from '../../data/layout-constants.json';

interface Props {
  onRenameRequest: (id: string) => void;
  rooms?: ConformityRoom[];
  violationIssues?: ConformityRuleIssue[];
  warningIssues?: ConformityRuleIssue[];
}

const statusConfig = {
  ok:      { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, text: 'Conformă legal', labelColor: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,  text: 'Atenție / Recomandare', labelColor: 'text-amber-700 bg-amber-50 border-amber-100' },
  error:   { icon: <XCircle className="w-4 h-4 text-red-500" />,          text: 'Neconformă legal', labelColor: 'text-red-700 bg-red-50 border-red-100' },
};

export const EditorPropertiesPanel: React.FC<Props> = ({ onRenameRequest, rooms = [], violationIssues = [], warningIssues = [] }) => {
  const { elements, selectedId, selectElement, deleteElement, activeRooms, addManualOpening, updateElement } = useEditorState();

  const currentSelected = elements.find((el) => el.id === selectedId);
  const [selected, setSelected] = useState(currentSelected);

  useEffect(() => {
    if (currentSelected) {
      setSelected(currentSelected);
    }
  }, [currentSelected]);

  return (
    <AnimatePresence>
      {selectedId && selected && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 240, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-sm overflow-hidden"
        >
          <div className="w-60 flex flex-col h-full shrink-0">
            {selected.type === 'door' || selected.type === 'window' ? (
              <>
                {/* Header Deschideri */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    {selected.type === 'door' ? 'Ușă' : 'Fereastră'}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteElement(selected.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title={`Șterge ${selected.type === 'door' ? 'Ușă' : 'Fereastră'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => selectElement(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                      title="Închide panoul"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Dimensiuni Deschidere
                  </p>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">Lățime / Lungime (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="5.0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                      value={parseFloat(pxToMeters(Math.max(selected.width, selected.height)).toFixed(2))}
                      onChange={(e) => {
                        const newMeters = parseFloat(e.target.value);
                        if (isNaN(newMeters) || newMeters < 0.1) return;
                        
                        const newPx = newMeters * 20; // 20px = 1m
                        const isVertical = selected.height > selected.width;
                        
                        updateElement(selected.id, {
                          width: isVertical ? selected.width : newPx,
                          height: isVertical ? newPx : selected.height,
                        });
                      }}
                    />
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Modifică lățimea pentru a ajusta aria vitrată sau accesul.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => deleteElement(selected.id)}
                      className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl border border-red-200 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Șterge {selected.type === 'door' ? 'Ușă' : 'Fereastră'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Header Camere / Pereți */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Proprietăți {selected.type === 'wall' ? 'Perete' : ''}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteElement(selected.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title={`Șterge ${selected.type === 'wall' ? 'Peretele' : 'Camera'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => selectElement(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                      title="Închide panoul"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  
                  {/* Wall specific properties */}
                  {selected.type === 'wall' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        Tip Perete
                      </label>
                      <label className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-sky-300 transition-all">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                          checked={selected.metadata?.isVirtualBoundary === true}
                          onChange={(e) => {
                            const isVirtual = e.target.checked;
                            updateElement(selected.id, {
                              metadata: { ...selected.metadata, isVirtualBoundary: isVirtual }
                            });
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">Gol de Trecere (Open Space)</span>
                          <span className="text-[10px] text-slate-500 leading-snug mt-0.5">
                            Transformă peretele fizic într-o linie imaginară care doar delimitează zonele funcționale (ex: Living / Bucătărie).
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                  
                  {/* Denumire */}
                  {selected.type === 'room' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        Denumire Cameră
                      </label>
                      <button
                        onClick={() => onRenameRequest(selected.id)}
                        className="w-full flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:border-orange-500 transition-colors text-left"
                      >
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{selected.label ?? 'Cameră'}</span>
                      </button>
                    </div>
                  )}



                  {/* Dimensiuni calculate */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      Dimensiuni Calculate
                    </label>
                    <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-1 text-xs font-semibold text-slate-600">
                      <div className="flex justify-between">
                        <span>Lățime:</span>
                        <span className="text-slate-800">{parseFloat(pxToMeters(selected.width).toFixed(2))} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lungime:</span>
                        <span className="text-slate-800">{parseFloat(pxToMeters(selected.height).toFixed(2))} m</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                        <span>Suprafață:</span>
                        <span className="text-slate-800">{(parseFloat(pxToMeters(selected.width).toFixed(2)) * parseFloat(pxToMeters(selected.height).toFixed(2))).toFixed(1)} m²</span>
                      </div>
                    </div>
                  </div>

                  {/* Conformity Warning Details */}
                  {selected.type === 'room' && rooms.find((r) => r.id === selected.id) && (() => {
                    const conformityData = rooms.find((r) => r.id === selected.id);
                    const status = conformityData?.conformityStatus ?? 'ok';
                    const statusDetails = statusConfig[status];
                    const totalSqm = parseFloat((parseFloat(pxToMeters(selected.width).toFixed(2)) * parseFloat(pxToMeters(selected.height).toFixed(2))).toFixed(1));

                    return (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          Conformitate Legală
                        </label>
                        <div className={`rounded-xl p-3 border text-xs space-y-2 font-semibold ${statusDetails.labelColor}`}>
                          <div className="flex items-center gap-1.5">
                            {statusDetails.icon}
                            <span>{statusDetails.text}</span>
                          </div>
                          <div className="text-[11px] leading-relaxed pt-1.5 border-t border-current/10 font-medium space-y-2">
                            {status === 'ok' ? (
                              <p>Camera respectă standardele minime conform Legii 114/1996.</p>
                            ) : (
                              // Găsim problemele specifice acestei camere
                              [...violationIssues, ...warningIssues]
                                .filter(issue => issue.targetId === selected.id)
                                .map((issue, idx) => (
                                  <div key={idx} className="flex flex-col gap-0.5">
                                    <span className="font-bold">{issue.message}</span>
                                    <span className="opacity-80">{issue.suggestion}</span>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Adăugare Deschideri */}
                  {selected.type === 'room' && (
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        Adaugă Deschideri Manual
                      </label>
                      <div className="space-y-3">
                        {/* Geamuri */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider">Geamuri</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                              const sideLabels = { top: 'Sus', bottom: 'Jos', left: 'Stânga', right: 'Dreapta' };
                              return (
                                <button
                                  key={side}
                                  onClick={() => addManualOpening(selected.id, 'window', side)}
                                  className="py-1.5 px-2 text-[10px] font-bold rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-600 transition-all text-center"
                                >
                                  + {sideLabels[side]}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Uși */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider">Uși</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                              const sideLabels = { top: 'Sus', bottom: 'Jos', left: 'Stânga', right: 'Dreapta' };
                              return (
                                <button
                                  key={side}
                                  onClick={() => addManualOpening(selected.id, 'door', side)}
                                  className="py-1.5 px-2 text-[10px] font-bold rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 transition-all text-center"
                                >
                                  + {sideLabels[side]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
