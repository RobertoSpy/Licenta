import React from 'react';
import { useEditorState, pxToMeters } from '../../hooks/useEditorState';
import { type ConformityRoom } from '../../hooks/useConformityCheck';
import { Trash2, Tag, Scale, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface Props {
  onRenameRequest: (id: string) => void;
  rooms?: ConformityRoom[];
}

const statusConfig = {
  ok:      { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, text: 'Conformă legal', labelColor: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,  text: 'Atenție / Recomandare', labelColor: 'text-amber-700 bg-amber-50 border-amber-100' },
  error:   { icon: <XCircle className="w-4 h-4 text-red-500" />,          text: 'Neconformă legal', labelColor: 'text-red-700 bg-red-50 border-red-100' },
};

const RATIO_PRESETS = [
  { value: 0.8, label: 'Foarte Mică' },
  { value: 1.2, label: 'Mică' },
  { value: 1.8, label: 'Medie' },
  { value: 2.5, label: 'Mare' },
  { value: 3.5, label: 'Foarte Mare' }
];

export const EditorPropertiesPanel: React.FC<Props> = ({ onRenameRequest, rooms = [] }) => {
  const { elements, selectedId, deleteElement, activeRooms, updateRoomRatio, addManualOpening, updateElement } = useEditorState();

  const selected = elements.find((el) => el.id === selectedId);

  if (!selected) {
    return (
      <div className="w-60 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Proprietăți</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <Info className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-semibold leading-relaxed">
              Apasă pe o cameră, ușă sau geam<br />pentru proprietăți
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (selected.type === 'door' || selected.type === 'window') {
    const title = selected.type === 'door' ? 'Ușă' : 'Fereastră';
    return (
      <div className="w-60 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{title}</h3>
          <button
            onClick={() => deleteElement(selected.id)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title={`Șterge ${title}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Această deschidere ({title.toLowerCase()}) este poziționată la coordonatele:
            <br />
            <strong>X: {selected.x} px, Y: {selected.y} px</strong>
          </p>
          <button
            onClick={() => deleteElement(selected.id)}
            className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl border border-red-200 transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" /> Șterge {title}
          </button>
        </div>
      </div>
    );
  }

  const widthM = parseFloat(pxToMeters(selected.width).toFixed(2));
  const heightM = parseFloat(pxToMeters(selected.height).toFixed(2));
  const totalSqm = parseFloat((widthM * heightM).toFixed(1));

  // Find detailed room conformity status from calculations
  const conformityData = rooms.find((r) => r.id === selected.id);
  const activeRoomData = activeRooms.find((r) => r.id === selected.id);

  const status = conformityData?.conformityStatus ?? 'ok';
  const statusDetails = statusConfig[status];

  return (
    <div className="w-60 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
          Proprietăți {selected.type === 'wall' ? 'Perete' : ''}
        </h3>
        <button
          onClick={() => deleteElement(selected.id)}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          title={`Șterge ${selected.type === 'wall' ? 'Peretele' : 'Camera'}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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

        {/* Pondere mărime (ratios) */}
        {selected.type === 'room' && activeRoomData && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-slate-400" /> Pondere Mărime
            </label>
            <div className="space-y-1.5">
              {RATIO_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => updateRoomRatio(selected.id, preset.value)}
                  className={`w-full text-left px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    activeRoomData.ratioValue === preset.value
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {preset.label} (x{preset.value})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dimensiuni calculate (read-only in configurator mode) */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Dimensiuni Calculate
          </label>
          <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-1 text-xs font-semibold text-slate-600">
            <div className="flex justify-between">
              <span>Lățime:</span>
              <span className="text-slate-800">{widthM} m</span>
            </div>
            <div className="flex justify-between">
              <span>Lungime:</span>
              <span className="text-slate-800">{heightM} m</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
              <span>Suprafață:</span>
              <span className="text-slate-800">{totalSqm} m²</span>
            </div>
          </div>
        </div>

        {/* Conformity Warning Details */}
        {selected.type === 'room' && conformityData && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Conformitate Legală
            </label>
            <div className={`rounded-xl p-3 border text-xs space-y-2 font-semibold ${statusDetails.labelColor}`}>
              <div className="flex items-center gap-1.5">
                {statusDetails.icon}
                <span>{statusDetails.text}</span>
              </div>
              {conformityData.minRequiredSqm && (
                <div className="text-[11px] leading-relaxed pt-1.5 border-t border-current/10 font-medium">
                  {status === 'ok' ? (
                    <p>Camera respectă suprafața utilă minimă de <strong>{conformityData.minRequiredSqm} m²</strong> conform Legii 114/1996.</p>
                  ) : (
                    <p>Suprafața utilă de <strong>{totalSqm} m²</strong> este sub minimul de <strong>{conformityData.minRequiredSqm} m²</strong>. Mărește ponderea mărimii sau dimensiunea casei.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

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
    </div>
  );
};
