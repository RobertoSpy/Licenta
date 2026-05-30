import { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import { Maximize, Layers, Compass, TrendingUp, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ProjectFormData } from './ProjectWizard';


interface Props {
  data: ProjectFormData;
  updateData: (fields: Partial<ProjectFormData>) => void;
  addSystemMessage?: (content: string) => void;
}

const MapBoundsController = ({ positions }: { positions: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [20, 20], maxZoom: 20 });
    }
  }, [positions, map]);
  return null;
};

const calculateAreaFromMeters = (points: { x: string, y: string }[]) => {
  const validPoints = points.filter(p => !isNaN(Number(p.x)) && !isNaN(Number(p.y)) && p.x !== '' && p.y !== '');
  if (validPoints.length < 3) return 0;
  const closedPath = [...validPoints, validPoints[0]];
  let area = 0;
  for (let i = 0; i < closedPath.length - 1; i++) {
    const x1 = Number(closedPath[i].x);
    const y1 = Number(closedPath[i].y);
    const x2 = Number(closedPath[i + 1].x);
    const y2 = Number(closedPath[i + 1].y);
    area += (x1 * y2) - (x2 * y1);
  }
  return Math.abs(area / 2);
};

const springConfig = { type: "spring" as const, stiffness: 300, damping: 20 };


export const Step2Terrain = ({ data, updateData, addSystemMessage }: Props) => {
  const calculatedArea = useMemo(() => calculateAreaFromMeters(data.plotCoordinates), [data.plotCoordinates]);
  const hasAskedTerrainQuestion = useRef(false);

  useEffect(() => {
    if (calculatedArea > 0 && data.plotAreaSqm !== calculatedArea) {
      updateData({ plotAreaSqm: calculatedArea });
    }
  }, [calculatedArea, data.plotAreaSqm, updateData]);

  useEffect(() => {
    if (addSystemMessage && !hasAskedTerrainQuestion.current) {
      if (data.slopePercent > 0 || (data.soilType && data.soilType !== 'Nu știu')) {
        hasAskedTerrainQuestion.current = true;
        let msg = "";
        if (data.slopePercent > 5) {
          msg = `Văd că terenul tău are o pantă de **${data.slopePercent}%**. Știai că o pantă mai mare de 5% necesită de obicei un studiu geotehnic mai aprofundat și soluții de fundare în trepte sau ziduri de sprijin? \n\nAi înțeles cum îți poate afecta panta costul fundației, sau vrei să detaliez?`;
        } else if (data.soilType && data.soilType !== 'Nu știu') {
          msg = `Ai selectat tipul de sol **${data.soilType}**. Tipul solului este determinant pentru presiunea convențională pe care o poate suporta terenul. \n\nAi idee cum influențează natura solului (${data.soilType}) adâncimea și costul fundației tale, sau ai dori să-ți explic?`;
        } else {
          msg = `Ai configurat datele despre pantă și sol! Aceste detalii geotehnice dictează tipul de fundație necesar. \n\nEști confortabil cu aceste valori și înțelegi impactul lor asupra costurilor, sau ai vrea să îți detaliez?`;
        }
        addSystemMessage(msg);
      }
    }
  }, [data.slopePercent, data.soilType, addSystemMessage]);

  const orientations = [
    { id: 'N', name: 'Nord' }, { id: 'NE', name: 'Nord-Est' }, 
    { id: 'E', name: 'Est' }, { id: 'SE', name: 'Sud-Est' },
    { id: 'S', name: 'Sud' }, { id: 'SV', name: 'Sud-Vest' }, 
    { id: 'V', name: 'Vest' }, { id: 'NV', name: 'Nord-Vest' }
  ];

  return (
    <div className="h-full flex flex-col md:flex-row gap-8 pb-10">
      {/* Partea Stângă: Date Teren */}
      <div className="w-full md:w-2/5 flex flex-col gap-6 overflow-y-auto pr-2">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={springConfig}>
          <h3 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2">
            <Layers className="text-buildorange w-6 h-6" /> Parametrii Geotehnici
          </h3>
          <p className="text-sm text-slate-500 mb-6 font-medium">Configurează detaliile fine ale terenului pentru un deviz precis.</p>

          <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-slate-200 flex items-center gap-4 mb-6 shadow-sm">
            <div className="bg-orange-100 p-3 rounded-2xl">
              <Maximize className="w-8 h-8 text-buildorange" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Suprafață Identificată</p>
              <p className="text-2xl font-black text-slate-900">{data.plotAreaSqm ? Number(data.plotAreaSqm).toFixed(2) : '0.00'} m²</p>
            </div>
          </div>
        </motion.div>

        {/* Tip Sol */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ ...springConfig, delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
        >
          <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-3">Natura Solului</label>
          <select
            className="w-full border-2 border-slate-100 bg-slate-50 hover:bg-white rounded-2xl p-4 outline-none focus:border-buildorange transition-all cursor-pointer font-bold text-slate-700"
            value={data.soilType}
            onChange={(e) => updateData({ soilType: e.target.value })}
          >
            <option value="Nu știu">Nu știu (Recomandat asistent)</option>
            <option value="Argilos">Argilos (Pământ normal)</option>
            <option value="Nisipos">Nisipos (Ușor permeabil)</option>
            <option value="Pietros">Pietros / Balastru</option>
            <option value="Stâncos">Stâncos / Dur</option>
          </select>
        </motion.div>

        {/* Pantă și Orientare */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pantă */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ ...springConfig, delay: 0.2 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Pantă Teren</label>
              <span className="text-lg font-black text-buildorange">{data.slopePercent}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="45" 
              step="1"
              value={data.slopePercent}
              onChange={(e) => updateData({ slopePercent: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-buildorange"
            />
            <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
               <span>Plan</span>
               <span>Înclinat</span>
            </div>
          </motion.div>

          {/* Orientare */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ ...springConfig, delay: 0.3 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-3">Către Stradă</label>
            <div className="relative">
              <select
                className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl p-4 outline-none focus:border-indigo-500 transition-all cursor-pointer font-bold text-slate-700 appearance-none"
                value={data.streetOrientation}
                onChange={(e) => updateData({ streetOrientation: e.target.value })}
              >
                {orientations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <Compass className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 pointer-events-none" />
            </div>
          </motion.div>
        </div>

        {/* Note Sol */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ ...springConfig, delay: 0.4 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
        >
          <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-3">Note adiționale teren (Opțional)</label>
          <textarea
            className="w-full border-2 border-slate-100 bg-slate-50 hover:bg-white rounded-2xl p-4 outline-none focus:border-buildorange transition-all font-medium text-slate-700 resize-none h-24"
            placeholder="Ex: Pânza freatică la suprafață, teren mlăștinos, umplutură etc."
            value={data.soilNotes || ''}
            onChange={(e) => updateData({ soilNotes: e.target.value })}
          />
        </motion.div>

        <div className="bg-slate-900/5 p-4 rounded-2xl flex gap-3">
          <Info className="w-5 h-5 text-slate-400 shrink-0" />
          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
            Aceste date influențează direct poziționarea casei pe teren (pantă) și necesarul de iluminat natural în funcție de punctele cardinale.
          </p>
        </div>
      </div>

      {/* Partea Dreaptă: Harta Satellite */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...springConfig, delay: 0.4 }}
        className="w-full md:w-3/5 flex flex-col"
      >
        <div className="flex-1 w-full rounded-[2.5rem] overflow-hidden border-8 border-white shadow-2xl relative z-0 min-h-[400px]">
          <MapContainer
            center={data.lat ? [data.lat, data.lng!] : [45.9432, 24.9668]}
            zoom={19}
            scrollWheelZoom={true}
            className="w-full h-full bg-slate-100"
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='Tiles &copy; Esri'
            />
            {data.polygonLatLngs.length > 0 && (
              <>
                <MapBoundsController positions={data.polygonLatLngs} />
                <Polygon
                  positions={data.polygonLatLngs}
                  pathOptions={{
                    color: '#fbbf24',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.45,
                    weight: 5,
                    dashArray: '10, 10'
                  }}
                />
              </>
            )}
          </MapContainer>
          
          {/* Card Detalii Geo */}
          <div className="absolute top-6 left-6 z-10 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-4 shadow-2xl">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-buildorange rounded-xl shadow-lg">
                   <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                   <p className="text-[10px] font-bold text-white uppercase tracking-tighter">Locație Confirmată</p>
                   <p className="text-sm font-black text-white">{data.county || 'România'}, {data.locality || ''}</p>
                </div>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
