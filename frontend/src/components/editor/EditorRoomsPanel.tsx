import React from 'react';
import { RoomInfo } from '../../hooks/useRoomCalculator';
import { useEditorState } from '../../hooks/useEditorState';
import { CheckCircle2, AlertTriangle, XCircle, Layers } from 'lucide-react';

interface Props {
  rooms: RoomInfo[];
}

const statusConfig = {
  ok:      { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
  warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,  bg: 'bg-amber-50',   border: 'border-amber-100',   text: 'text-amber-700'   },
  error:   { icon: <XCircle className="w-4 h-4 text-red-500" />,          bg: 'bg-red-50',     border: 'border-red-100',     text: 'text-red-700'     },
};

export const EditorRoomsPanel: React.FC<Props> = ({ rooms }) => {
  const { selectElement, selectedId } = useEditorState();

  const totalUsable = rooms.reduce((sum, r) => sum + r.usableSqm, 0);
  const violations = rooms.filter((r) => r.conformityStatus === 'error');

  return (
    <div className="w-60 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-buildorange" /> Camere
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">
          Total util: <strong className="text-slate-800">{totalUsable.toFixed(1)} m²</strong>
        </p>
        {violations.length > 0 && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-xs text-red-700 font-semibold">
              {violations.length} cameră sub limita legală
            </p>
          </div>
        )}
      </div>

      {/* Lista camere */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {rooms.length === 0 && (
          <div className="text-center py-8">
            <Layers className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Nicio cameră desenată</p>
            <p className="text-xs text-slate-400 mt-1">Alege tool-ul Cameră (R)</p>
          </div>
        )}

        {rooms.map((room) => {
          const config = statusConfig[room.conformityStatus];
          const isSelected = selectedId === room.id;

          return (
            <button
              key={room.id}
              onClick={() => selectElement(room.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${config.bg} ${config.border} ${
                isSelected ? 'ring-2 ring-buildorange' : 'hover:ring-1 hover:ring-buildorange/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{room.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {room.widthM}m × {room.heightM}m
                  </p>
                </div>
                {config.icon}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`text-xs font-bold ${config.text}`}>
                  {room.usableSqm} m² util
                </span>
                {room.minRequiredSqm && room.conformityStatus !== 'ok' && (
                  <span className="text-[10px] text-slate-400">
                    min {room.minRequiredSqm} m²
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
