import React from 'react';
import { useEditorState, pxToMeters, metersToPx } from '../../hooks/useEditorState';
import { Trash2, RotateCcw, Tag } from 'lucide-react';

interface Props {
  onRenameRequest: (id: string) => void;
}

export const EditorPropertiesPanel: React.FC<Props> = ({ onRenameRequest }) => {
  const { elements, selectedId, updateElement, deleteElement } = useEditorState();

  const selected = elements.find((el) => el.id === selectedId);

  if (!selected) {
    return (
      <div className="w-56 bg-white border-l border-slate-200 flex flex-col h-full">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900">Proprietăți</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-slate-400 text-center">
            Selectează un element<br />pentru a-i modifica proprietățile
          </p>
        </div>
      </div>
    );
  }

  const widthM = parseFloat(pxToMeters(selected.width).toFixed(2));
  const heightM = parseFloat(pxToMeters(selected.height).toFixed(2));

  const handleDimChange = (field: 'width' | 'height', meters: number) => {
    if (meters < 0.5) return;
    updateElement(selected.id, { [field]: metersToPx(meters) });
  };

  return (
    <div className="w-56 bg-white border-l border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900">Proprietăți</h3>
        <button
          onClick={() => deleteElement(selected.id)}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Șterge (Del)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Label */}
        {selected.type === 'room' && (
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
              Denumire Cameră
            </label>
            <button
              onClick={() => onRenameRequest(selected.id)}
              className="w-full flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:border-buildorange transition-colors text-left"
            >
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{selected.label ?? 'Cameră'}</span>
            </button>
          </div>
        )}

        {/* Dimensiuni */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
            Dimensiuni
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-slate-400 mb-1 font-medium">Lățime (m)</p>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={widthM}
                onChange={(e) => handleDimChange('width', parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold outline-none focus:border-buildorange text-center"
              />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1 font-medium">Adâncime (m)</p>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={heightM}
                onChange={(e) => handleDimChange('height', parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold outline-none focus:border-buildorange text-center"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center font-medium">
            {widthM} × {heightM} = {(widthM * heightM).toFixed(1)} m²
          </p>
        </div>

        {/* Grosime perete */}
        {selected.type === 'room' && (
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
              Grosime Pereți
            </label>
            <select
              value={selected.wallThicknessCm ?? 25}
              onChange={(e) => updateElement(selected.id, { wallThicknessCm: parseInt(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-semibold outline-none focus:border-buildorange"
            >
              <option value={25}>25 cm (exterior)</option>
              <option value={12}>12.5 cm (interior)</option>
              <option value={30}>30 cm (izolat)</option>
            </select>
          </div>
        )}

        {/* Poziție */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
            Poziție
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-slate-400 mb-1 font-medium">X (m)</p>
              <p className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 text-center">
                {pxToMeters(selected.x).toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1 font-medium">Y (m)</p>
              <p className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 text-center">
                {pxToMeters(selected.y).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
