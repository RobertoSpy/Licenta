import React, { useState } from 'react';
import { type ConformityRoom } from '../../hooks/useConformityCheck';
import { useEditorState } from '../../hooks/useEditorState';
import { CheckCircle2, AlertTriangle, XCircle, Home, Compass, Settings, CheckSquare, SquareDot, Sparkles } from 'lucide-react';
import { AiRoomSuggestModal } from './AiRoomSuggestModal';

interface Props {
  rooms: ConformityRoom[];
  projectId: number;
  projectData: Record<string, unknown> | null;
}

const statusConfig = {
  ok:      { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />, bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-700' },
  warning: { icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,  bg: 'bg-amber-50/50',   border: 'border-amber-100',   text: 'text-amber-700'   },
  error:   { icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,          bg: 'bg-red-50/50',     border: 'border-red-100',     text: 'text-red-700'     },
};

const ALL_AVAILABLE_ROOMS = [
  'Living',
  'Bucătărie',
  'Dormitor 1',
  'Dormitor 2',
  'Dormitor 3',
  'Baie',
  'WC',
  'Hol',
  'Debara',
  'Birou'
];

export const EditorRoomsPanel: React.FC<Props> = ({ rooms, projectId, projectData }) => {
  const {
    houseShape,
    dimensions,
    activeRooms,
    setHouseShape,
    setDimensions,
    toggleRoom,
    selectElement,
    selectedId,
    isAiModalOpen,
    setAiModalOpen
  } = useEditorState();

  const totalUsable = rooms.reduce((sum, r) => sum + r.usableSqm, 0);
  const violations = rooms.filter((r) => r.conformityStatus === 'error');

  const handleDimensionChange = (key: keyof typeof dimensions, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      setDimensions({ [key]: num });
    }
  };

  return (
    <>
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0 shadow-sm">

        {/* Scrollable controls */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Section 1: Shape */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5 text-slate-400" /> 1. Forma Casei
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'rectangle', label: 'Dreptunghi' },
              { id: 'l_shape', label: 'Forma L' },
              { id: 'u_shape', label: 'Forma U' },
              { id: 't_shape', label: 'Forma T' }
            ] as const).map((shape) => (
              <button
                key={shape.id}
                onClick={() => setHouseShape(shape.id)}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                  houseShape === shape.id
                    ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm shadow-orange-100'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                }`}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Dimensions */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-slate-400" /> 2. Dimensiuni Amprentă
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">LĂȚIME TOTALĂ (M)</label>
              <input
                type="number"
                min="5"
                max="30"
                step="0.5"
                value={dimensions.widthM}
                onChange={(e) => handleDimensionChange('widthM', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">LUNGIME TOTALĂ (M)</label>
              <input
                type="number"
                min="5"
                max="30"
                step="0.5"
                value={dimensions.heightM}
                onChange={(e) => handleDimensionChange('heightM', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Extra dimension inputs for wings if L, U or T shapes are active */}
          {houseShape !== 'rectangle' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">LĂȚIME ARIPĂ (M)</label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  step="0.5"
                  value={dimensions.wingWidthM ?? 4}
                  onChange={(e) => handleDimensionChange('wingWidthM', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">LUNGIME ARIPĂ (M)</label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  step="0.5"
                  value={dimensions.wingLengthM ?? 4}
                  onChange={(e) => handleDimensionChange('wingLengthM', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Rooms Checklist */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-slate-400" /> 3. Camere Dorite
          </h3>

          {/* AI suggestion button */}
          <button
            id="ai-room-suggest-btn"
            onClick={() => setAiModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 text-violet-700 font-bold text-xs transition-all group"
          >
            <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            Sugestie AI Camere
          </button>
          <div className="grid grid-cols-2 gap-2">
            {ALL_AVAILABLE_ROOMS.map((roomLabel) => {
              const isChecked = activeRooms.some((r) => r.label === roomLabel);
              return (
                <button
                  key={roomLabel}
                  onClick={() => toggleRoom(roomLabel, !isChecked)}
                  className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border transition-all text-xs font-semibold ${
                    isChecked
                      ? 'border-orange-200 bg-orange-50/50 text-slate-800'
                      : 'border-slate-100 hover:bg-slate-50 text-slate-500 bg-slate-50/20'
                  }`}
                >
                  <SquareDot className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-orange-500' : 'text-slate-300'}`} />
                  <span className="truncate">{roomLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4: Live verification summary */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-slate-400" /> 4. Status Proiect
          </h3>
          <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100 text-xs space-y-1.5 font-semibold text-slate-600">
            <div className="flex justify-between">
              <span>Suprafață Amprentă:</span>
              <span className="text-slate-800 font-bold">
                {houseShape === 'rectangle'
                  ? (dimensions.widthM * dimensions.heightM).toFixed(1)
                  : houseShape === 'l_shape'
                  ? (
                      (dimensions.wingWidthM ?? 4) * dimensions.heightM +
                      (dimensions.widthM - (dimensions.wingWidthM ?? 4)) * (dimensions.wingLengthM ?? 4)
                    ).toFixed(1)
                  : houseShape === 'u_shape'
                  ? (
                      2 * (dimensions.wingWidthM ?? 4) * dimensions.heightM +
                      (dimensions.widthM - 2 * (dimensions.wingWidthM ?? 4)) * (dimensions.wingLengthM ?? 4)
                    ).toFixed(1)
                  : (
                      dimensions.widthM * (dimensions.wingLengthM ?? 4) +
                      (dimensions.wingWidthM ?? 4) * (dimensions.heightM - (dimensions.wingLengthM ?? 4))
                    ).toFixed(1) // T shape
                } m²
              </span>
            </div>
            <div className="flex justify-between">
              <span>Suprafață Utilă:</span>
              <span className="text-slate-800 font-bold">{totalUsable.toFixed(1)} m²</span>
            </div>
            {violations.length > 0 && (
              <div className="pt-1.5 text-red-600 text-[10px] font-black flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                {violations.length} {violations.length === 1 ? 'încălcare legală' : 'încălcări legale'}
              </div>
            )}
          </div>
        </div>

        {/* Active room status items */}
        <div className="space-y-2 pt-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Așezare Camere (Apasă pt selectare/detalii)</p>
          <div className="space-y-1.5">
            {rooms.map((room) => {
              const config = statusConfig[room.conformityStatus];
              const isSelected = selectedId === room.id;

              return (
                <button
                  key={room.id}
                  onClick={() => selectElement(room.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between transition-all ${config.bg} ${config.border} ${
                    isSelected ? 'ring-2 ring-orange-500' : 'hover:ring-1 hover:ring-orange-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate block">{room.label}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {room.widthM}m × {room.heightM}m ({room.usableSqm} m² util)
                    </span>
                  </div>
                  {config.icon}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>

      {/* AI Room Suggestion Modal */}
      <AiRoomSuggestModal
        projectId={projectId}
        projectData={projectData}
        isOpen={isAiModalOpen}
        onClose={() => setAiModalOpen(false)}
      />
    </>
  );
};
