import { useState, useEffect, useRef } from 'react';
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
  addSystemMessage?: (content: string) => void;
}

// Nominatim API result shape
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
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

// MapCenterController forțează camera hărții pe un anumit centru (folosit pt căutare manuală)
const MapCenterController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
};

export const Step1Location = ({ data, updateData }: Props) => {
  const [errorMsg, setErrorMsg] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);
  const [inputMode, setInputMode] = useState<'stereo70' | 'manual'>('stereo70');

  // Stări pentru Flux B - Căutare Nominatim
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Efect: De fiecare dată când utilizatorul editează tabelul X/Y, încercăm să generăm poligonul GPS
  useEffect(() => {
    if (inputMode !== 'stereo70') return;
    try {
      const validPoints = data.plotCoordinates.filter(p => p.x && p.y && !isNaN(Number(p.x)) && !isNaN(Number(p.y)));

      // Dacă avem cel puțin 3 puncte (un poligon valid)
      if (validPoints.length >= 3) {
        const latLngs: [number, number][] = validPoints.map(p => {
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
  }, [data.plotCoordinates, inputMode]);

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

  const handleLocationSearch = (value: string) => {
    setSearchQuery(value);
    
    // Debounce 600ms — nu spamăm Nominatim la fiecare tastă
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value + ', România')}&format=json&limit=5&countrycodes=ro&accept-language=ro`
        );
        const results = await response.json();
        setSearchResults(results);
      } catch (err) {
        console.error('Nominatim search error:', err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 600);
  };

  const handleSelectLocation = async (result: NominatimResult) => {
    setSearchQuery(result.display_name.split(',')[0]); // afișezi doar numele scurt
    setSearchResults([]); // închizi dropdown-ul

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    updateData({ lat, lng, polygonLatLngs: [] });
    // Restul (județ, seismic, frost) se extrag automat prin useEffect-ul existent
  };

  const lastFetchedLatLng = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const fetchGeospatialData = async () => {
      // Avem nevoie de lat/lng pentru backend ca sa extraga si county si locality via reverse geocoding
      if (!data.lat || !data.lng) return;

      if (
        lastFetchedLatLng.current?.lat === data.lat &&
        lastFetchedLatLng.current?.lng === data.lng
      ) {
        return; // Am adus deja datele pt coordonatele astea, prevenim duplicate la navigarea back/forward
      }

      lastFetchedLatLng.current = { lat: data.lat, lng: data.lng };

      setIsPredicting(true);
      try {
        const { data: result } = await api.post('/terrain/analyze-location', {
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
          
          // Stergem injectarea automata a intrebarii AI
          // Acum tot flow-ul se bazeaza pe mesajul introductiv din useScreenTutor
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
          className="w-full bg-white border border-slate-300 rounded-xl p-4 text-lg outline-none focus:ring-2 focus:ring-buildorange/50 focus:border-buildorange transition-all mb-4"
          placeholder="Ex: Casa Visurilor Mele"
          value={data.title}
          onChange={(e) => updateData({ title: e.target.value })}
        />

        <h3 className="text-xl font-bold text-slate-900 mb-2">Destinația Clădirii</h3>
        <select
          className="w-full bg-white border border-slate-300 rounded-xl p-4 text-lg outline-none focus:ring-2 focus:ring-buildorange/50 focus:border-buildorange transition-all"
          value={data.buildingPurpose}
          onChange={(e) => updateData({ buildingPurpose: e.target.value })}
        >
          <option value="residential">Locuință / Familie</option>
          <option value="commercial">Spațiu Comercial / Birouri</option>
          <option value="mixed">Mixt</option>
        </select>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-8 min-h-[400px]">

        {/* Partea Stângă: Selecție locație */}
        <div className="w-full md:w-1/2 lg:w-1/3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="text-buildorange" /> 2. Locație Teren
            </h3>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setInputMode('stereo70');
                  setSearchQuery('');
                  updateData({ lat: null, lng: null });
                }}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${inputMode === 'stereo70' ? 'bg-white text-buildorange shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Stereo 70
              </button>
              <button
                onClick={() => {
                  setInputMode('manual');
                  updateData({
                    plotCoordinates: [
                      { x: '', y: '' },
                      { x: '', y: '' },
                      { x: '', y: '' },
                      { x: '', y: '' },
                    ],
                    polygonLatLngs: []
                  });
                }}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${inputMode === 'manual' ? 'bg-white text-buildorange shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Căutare (Manual)
              </button>
            </div>
          </div>

          {inputMode === 'stereo70' ? (
            <>
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
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex-1 flex flex-col">
              <div className="flex flex-col gap-3 relative">
                <p className="text-sm text-slate-500">
                  Caută localitatea, comuna sau satul unde se află terenul.
                </p>

                <div className="relative">
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-buildorange/50 focus:border-buildorange transition-all"
                    placeholder="Ex: Cotu Vameș, Florești, Baciu..."
                    value={searchQuery}
                    onChange={(e) => handleLocationSearch(e.target.value)}
                  />
                  
                  {/* Loading */}
                  {isSearchingLocation && (
                    <div className="absolute right-3 top-3.5">
                      <div className="w-4 h-4 border-2 border-buildorange border-t-transparent rounded-full animate-spin"/>
                    </div>
                  )}

                  {/* Dropdown rezultate */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 z-50 overflow-hidden max-h-60 overflow-y-auto">
                      {searchResults.map((result, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectLocation(result)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {result.display_name.split(',')[0]}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {result.display_name}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirmare selecție */}
                {data.lat && !isSearchingLocation && inputMode === 'manual' && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-600 shrink-0"/>
                      <p className="text-sm text-green-700 truncate">
                        <strong>{data.locality || searchQuery}</strong>
                        {data.county && `, jud. ${data.county}`}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Arie Teren (m²)
                      </label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm font-bold outline-none focus:ring-1 focus:ring-buildorange"
                        placeholder="Ex: 500"
                        value={data.plotAreaSqm || ''}
                        onChange={(e) => updateData({ plotAreaSqm: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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

            {data.polygonLatLngs.length === 0 && data.lat && data.lng && inputMode === 'manual' && (
               <MapCenterController center={[data.lat, data.lng]} />
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
