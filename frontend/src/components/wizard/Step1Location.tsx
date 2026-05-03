import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Plus, Trash2, Cpu } from 'lucide-react';
import proj4 from 'proj4';
import type { ProjectFormData } from './ProjectWizard';
import { api } from '../../api/axios';
import { Skeleton } from '../ui/Skeleton';

// Definire EPSG:31700 (Stereo 70 România) vs WGS84
proj4.defs("EPSG:31700", "+proj=sterea +lat_0=46 +lon_0=25 +k=0.99975 +x_0=500000 +y_0=500000 +ellps=krass +towgs84=2.329,-147.042,-92.08,0.309,-0.325,-0.497,5.69 +units=m +no_defs");

interface Props {
  data: ProjectFormData;
  updateData: (fields: Partial<ProjectFormData>) => void;
}

// MapController forțează camera hărții să încadreze poligonul generat
const MapBoundsController = ({ positions }: { positions: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [50, 50], maxZoom: 20 });
    }
  }, [positions, map]);
  return null;
};

export const Step1Location = ({ data, updateData }: Props) => {
  const [errorMsg, setErrorMsg] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);

  // Efect: De fiecare dată când utilizatorul editează tabelul X/Y, încercăm să generăm poligonul GPS
  useEffect(() => {
    try {
      const validPoints = data.plotCoordinates.filter(p => p.x && p.y && !isNaN(Number(p.x)) && !isNaN(Number(p.y)));

      // Dacă avem cel puțin 3 puncte (un poligon valid)
      if (validPoints.length >= 3) {
        const latLngs: [number, number][] = validPoints.map(p => {
          // proj4 folosește order [East, North] adică [Y, X] în Stereo 70 standard românesc.
          // Uzual X=Nord(aprox 300k-700k), Y=Est(aprox 200k-800k).
          const easting = Number(p.y);
          const northing = Number(p.x);
          const [lng, lat] = proj4("EPSG:31700", "EPSG:4326", [easting, northing]);
          return [lat, lng];
        });

        const avgLat = latLngs.reduce((sum, p) => sum + p[0], 0) / latLngs.length;
        const avgLng = latLngs.reduce((sum, p) => sum + p[1], 0) / latLngs.length;

        updateData({ polygonLatLngs: latLngs, lat: avgLat, lng: avgLng });
        setErrorMsg('');
      } else {
        updateData({ polygonLatLngs: [] });
      }
    } catch (err) {
      console.error("Proj4 Eroare transformare:", err);
      setErrorMsg("Eroare conversie coordonate. Verifică valorile!");
    }
  }, [data.plotCoordinates]);

  const addPoint = () => {
    updateData({ plotCoordinates: [...data.plotCoordinates, { x: '', y: '' }] });
  };

  const removePoint = (index: number) => {
    if (data.plotCoordinates.length <= 3) {
      alert("Un teren are nevoie de minim 3 puncte (triunghi)!");
      return;
    }
    const newCoords = data.plotCoordinates.filter((_, i) => i !== index);
    updateData({ plotCoordinates: newCoords });
  };

  const handleChange = (index: number, field: 'x' | 'y', value: string) => {
    const newCoords = [...data.plotCoordinates];
    newCoords[index][field] = value;
    updateData({ plotCoordinates: newCoords });
  };

  useEffect(() => {
    const fetchGeospatialData = async () => {
      // Verificăm dacă avem coordonate calculate din Stereo 70
      if (!data.lat || !data.lng) return;

      setIsPredicting(true);
      try {
        const { data: result } = await api.post('/api/terrain/analyze-location', {
          lat: data.lat,
          lng: data.lng
        });

        if (result.status === 'success') {
          updateData({
            county: result.data.county,
            locality: result.data.locality,
            seismicZone: result.data.seismicZone,
            frostDepthCm: result.data.frostDepthCm
          });
        }
      } catch (err) {
        console.error("Eroare la analiza locației:", err);
      } finally {
        // Punem un mic delay artificial de 800ms ca să se vadă Skeletons (UX Feel)
        setTimeout(() => setIsPredicting(false), 800);
      }
    };

    fetchGeospatialData();
  }, [data.lat, data.lng]);

  const defaultCenter: [number, number] = [45.9432, 24.9668]; // Centrul României

  return (
    <div className="h-full flex flex-col gap-6">
      <div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">1. Numele Proiectului</h3>
        <input
          type="text"
          className="w-full bg-white border border-slate-300 rounded-xl p-4 text-lg outline-none focus:ring-2 focus:ring-buildorange/50 focus:border-buildorange transition-all"
          placeholder="Ex: Casa Visurilor Mele"
          value={data.title}
          onChange={(e) => updateData({ title: e.target.value })}
        />
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-8 min-h-[400px]">

        {/* Partea Stângă: Tabelul de Coordonate */}
        <div className="w-full md:w-1/2 lg:w-1/3 flex flex-col">
          <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <MapPin className="text-buildorange" /> 2. Coordonate Teren
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Introdu coordonatele <strong className="text-slate-700">Stereo 70</strong> din planul de amplasament și delimitare (PAD).
            <br /><strong className="text-slate-700 block mt-1">X = Nord (ex: 582300), Y = Est (ex: 324100)</strong>
          </p>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col max-h-[350px]">
            <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 p-3 font-bold text-slate-700 text-sm text-center">
              <div className="col-span-2">Pct</div>
              <div className="col-span-4">X (Nord)</div>
              <div className="col-span-4">Y (Est)</div>
              <div className="col-span-2"></div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {data.plotCoordinates.map((point, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2 font-bold text-slate-400 text-center">{i + 1}</div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="X coord"
                      className="w-full border border-slate-300 rounded p-2 text-sm text-center outline-none focus:border-buildorange focus:ring-1 focus:ring-buildorange"
                      value={point.x}
                      onChange={(e) => handleChange(i, 'x', e.target.value)}
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Y coord"
                      className="w-full border border-slate-300 rounded p-2 text-sm text-center outline-none focus:border-buildorange focus:ring-1 focus:ring-buildorange"
                      value={point.y}
                      onChange={(e) => handleChange(i, 'y', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <button
                      onClick={() => removePoint(i)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={addPoint}
                className="w-full mt-4 py-2 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-lg hover:border-buildorange hover:text-buildorange transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Adaugă Punct
              </button>
              {errorMsg && <p className="text-red-500 text-xs font-bold text-center mt-2">{errorMsg}</p>}
            </div>
          </div>
        </div>

        {/* Partea Dreaptă: Harta Satelit */}
        <div className="flex-1 w-full rounded-2xl overflow-hidden border-2 border-slate-200 relative z-0 shadow-inner min-h-[300px]">
          <MapContainer
            center={data.lat ? [data.lat, data.lng!] : defaultCenter}
            zoom={data.lat ? 19 : 6}
            scrollWheelZoom={true}
            className="w-full h-full"
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
                    weight: 4,
                    dashArray: '8, 8'
                  }}
                />
              </>
            )}
          </MapContainer>
        </div>

      </div>

      {/* AI Prediction Section */}
      {(data.lat || isPredicting) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Cpu className="text-buildorange w-5 h-5" /> 
            {isPredicting ? "Predicting Technical Data..." : "Technical Terrain Data (AI Extracted)"}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Județ / Localitate */}
            <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
              {isPredicting ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <>
                  <p className="text-lg font-bold text-slate-800">{data.county || "Necunoscut"}</p>
                  <p className="text-sm text-slate-500">{data.locality || "-"}</p>
                </>
              )}
            </div>

            {/* Zonă Seismică */}
            <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Seismic Zone (ag)</p>
              {isPredicting ? (
                <Skeleton className="h-8 w-1/2 mt-1" />
              ) : (
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-black text-red-500">{data.seismicZone || "-"}</p>
                  <p className="text-sm text-slate-500 mb-1 font-medium">accelerație</p>
                </div>
              )}
            </div>

            {/* Adâncime Îngheț */}
            <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Frost Depth Requirement</p>
              {isPredicting ? (
                <Skeleton className="h-8 w-1/2 mt-1" />
              ) : (
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-black text-blue-500">{data.frostDepthCm ? `${data.frostDepthCm} cm` : "-"}</p>
                  <p className="text-sm text-slate-500 mb-1 font-medium">NP 112-2014</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
