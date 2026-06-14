import React from 'react';
import { type ConformityRoom } from '../../hooks/useConformityCheck';
import { useEditorState } from '../../hooks/useEditorState';
import { CheckCircle2, AlertTriangle, XCircle, Home, Compass, Settings, Sparkles } from 'lucide-react';
import { AiRoomSuggestModal } from './AiRoomSuggestModal';
import { calculateShapeArea } from '../../utils/layoutPartitioner';
import LAYOUT_CONSTANTS from '../../data/layout-constants.json';


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

export const EditorRoomsPanel: React.FC<Props> = ({ rooms, projectId, projectData }) => {
  const {
    houseShape,
    dimensions,
    setHouseShape,
    setDimensions,
    selectElement,
    selectedId,
    isAiModalOpen,
    setAiModalOpen,
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
            {LAYOUT_CONSTANTS.shapes.map((shape) => (
              <button
                key={shape.value}
                onClick={() => setHouseShape(shape.value as any)}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                  houseShape === shape.value
                    ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm shadow-orange-100'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                }`}
              >
                {shape.label.split(' (')[0]}
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

        {/* AI suggestion button - moved up from section 3 */}
        <div className="space-y-2">
          <button
            id="ai-room-suggest-btn"
            onClick={() => setAiModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 text-violet-700 font-bold text-xs transition-all group"
          >
            <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            Sugestie AI Camere
          </button>
        </div>

        {/* Section 4: Live verification summary */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-slate-400" /> 4. Status Proiect
          </h3>
          <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100 text-xs space-y-1.5 font-semibold text-slate-600">
            {Number(projectData?.totalFloors || 1) > 1 && (
              <div className="flex justify-between text-indigo-600 pb-1 border-b border-indigo-100/50 mb-1.5">
                <span>Total Construit (P+{Number(projectData?.totalFloors || 1) - 1}):</span>
                <span className="font-bold">
                  ~{(calculateShapeArea(houseShape, dimensions) * Number(projectData?.totalFloors || 1)).toFixed(1)} m²
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Amprentă (Etaj Curent):</span>
              <span className="text-slate-800 font-bold">
                {calculateShapeArea(houseShape, dimensions).toFixed(1)} m²
              </span>
            </div>
            <div className="flex justify-between">
              <span>Util (Etaj Curent):</span>
              <span className="text-slate-800 font-bold">{totalUsable.toFixed(1)} m²</span>
            </div>
            {violations.length > 0 && (
              <div className="pt-1.5 text-red-600 text-[10px] font-black flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                {violations.length} {violations.length === 1 ? 'încălcare legală' : 'încălcări legale'} pe etaj
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
