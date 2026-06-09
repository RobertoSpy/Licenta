/**
 * frontend/src/pages/dashboard/MarketAnalysis.tsx
 *
 * Market Intelligence — Analiza pieței construcțiilor din România
 * Date: INSSE CNS107D (ian 2005 → mar 2026) + Prognoze AI 2027-2028
 * Structura: HeroCard → PriceEvolutionChart → ForecastCards → MarketChat
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { marketApi } from '../../api/marketApi';
import type { ChartDataPoint, MarketForecastResponse, MarketSummaryResponse, LatestValue } from '../../api/marketApi';
import { aiApi } from '../../api/aiApi';

// ─── Iconițe inline ─────────────────────────────────────────────────────────

const TrendUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const TrendDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
  </svg>
);
const BrainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
);
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

// ─── Constante ───────────────────────────────────────────────────────────────

const MONTH_LABELS = ['', 'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SUGGESTED_QUESTIONS = [
  'E bine să construiesc acum sau să aștept?',
  'Cum a afectat criza din 2022 prețurile?',
  'Ce componente s-au scumpit cel mai mult?',
  'Cât estimezi că va costa în 2028 față de 2026?',
  'Care e diferența între indicele materialelor și indicele total?',
];



// ─── Tooltip custom ──────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs min-w-[160px]">
      <p className="text-slate-300 font-semibold mb-2">{label}</p>
      {payload.map((entry: any) => {
        if (entry.value == null) return null;
        return (
          <div key={entry.dataKey} className="flex justify-between gap-4 mb-1">
            <span style={{ color: entry.color }} className="truncate">{entry.name}</span>
            <span className="text-white font-bold">{Number(entry.value).toFixed(1)}</span>
          </div>
        );
      })}
      <p className="text-slate-500 mt-2 text-[10px]">Baza INSSE: ian 2005 ≈ 38</p>
    </div>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  yoy: number | null;
  color: string;
  subtitle?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, yoy, color, subtitle }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1 shadow-lg">
    <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
    <p className="text-white text-2xl font-bold" style={{ color }}>{value}</p>
    {yoy != null && (
      <div className={`flex items-center gap-1 text-xs font-semibold ${yoy > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
        {yoy > 0 ? <TrendUpIcon /> : <TrendDownIcon />}
        <span>{yoy > 0 ? '+' : ''}{yoy.toFixed(1)}% YoY</span>
      </div>
    )}
    {subtitle && <p className="text-slate-500 text-[10px] mt-1">{subtitle}</p>}
  </div>
);

// ─── Forecast Card ───────────────────────────────────────────────────────────

interface ForecastCardProps {
  year: number;
  predicted: number;
  lower: number;
  upper: number;
  yoy: number;
  isNear?: boolean;
}

const ForecastCard: React.FC<ForecastCardProps> = ({ year, predicted, lower, upper, yoy, isNear }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className={`relative overflow-hidden rounded-2xl border p-6 shadow-lg ${
      isNear
        ? 'bg-gradient-to-br from-blue-950 to-blue-900 border-blue-800'
        : 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-800'
    }`}
  >
    {isNear && (
      <div className="absolute top-3 right-3 bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
        MAI SIGUR
      </div>
    )}
    <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Prognoza</p>
    <p className="text-white text-4xl font-black mb-1">{year}</p>
    <div className="flex items-baseline gap-2 mb-3">
      <span className="text-2xl font-bold text-blue-300">{predicted.toFixed(1)}</span>
      <span className="text-slate-400 text-sm">indice estimat</span>
    </div>
    <div className="bg-slate-900/40 rounded-xl p-3 mb-3">
      <p className="text-slate-400 text-xs mb-1">Interval de încredere</p>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
            style={{ width: '60%', marginLeft: '20%' }}
          />
        </div>
        <span className="text-blue-300 text-xs font-semibold whitespace-nowrap">
          {lower.toFixed(0)} – {upper.toFixed(0)}
        </span>
      </div>
    </div>
    <div className={`flex items-center gap-1 text-sm font-semibold ${yoy > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
      {yoy > 0 ? <TrendUpIcon /> : <TrendDownIcon />}
      <span>{yoy > 0 ? '+' : ''}{yoy.toFixed(1)}% față de {year - 1}</span>
    </div>
  </motion.div>
);

// ─── PAGINA PRINCIPALĂ ───────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export const MarketAnalysis: React.FC = () => {
  // State
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [forecast, setForecast] = useState<MarketForecastResponse | null>(null);
  const [summary, setSummary] = useState<MarketSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState({
    rezidential: true,
    nerezidential: true,
    total_cladiri: false,
    total_materiale: true,
  });

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Fetch date ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [historyRes, forecastRes, summaryRes] = await Promise.all([
          marketApi.getHistory(),
          marketApi.getForecast(),
          marketApi.getSummary(),
        ]);

        // Adăugăm punctele de prognoză (linie punctată)
        const historicalData = historyRes.data;
        const lastReal = historicalData[historicalData.length - 1];

        // Construim 2 puncte extra pentru fiecare an de prognoză
        const forecastPoints: ChartDataPoint[] = forecastRes.years.map(fy => ({
          label: `Iun ${fy.year}`,
          year: fy.year,
          month: 6,
          // Nu completăm liniile istorice pentru datele de prognoză
          forecast_rezidential: fy.predictedIndex,
          forecast_lower: fy.lowerBound,
          forecast_upper: fy.upperBound,
        }));

        // Punct de joncțiune (ultimul real + primul forecast)
        const junctionPoint: ChartDataPoint = {
          ...lastReal,
          forecast_rezidential: lastReal.rezidential,
        };

        const combinedData = [
          ...historicalData.slice(0, -1),
          junctionPoint,
          ...forecastPoints,
        ];

        setChartData(combinedData);
        setForecast(forecastRes);
        setSummary(summaryRes);
      } catch (e: any) {
        setError('Nu am putut încărca datele de piață. Verificați conexiunea și reîncercați.');
        console.error('[MarketAnalysis] Eroare fetch:', e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatStreaming, chatOpen]);

  // ─── Chat ─────────────────────────────────────────────────────────────────

  const sendChatMessage = useCallback(async (question: string) => {
    if (!question.trim() || isChatStreaming) return;
    setChatOpen(true);

    const userMsg: ChatMessage = { role: 'user', text: question };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatStreaming(true);

    // Placeholder AI
    setChatMessages(prev => [...prev, { role: 'assistant', text: '' }]);

    let fullText = '';
    try {
      await aiApi.streamChat(
        {
          message: question,
          screen: 'market',
          projectContext: {},
          history: chatMessages.map(m => ({ role: m.role, content: m.text })),
          historySummary: null,
        },
        (chunk) => {
          fullText += chunk;
          setChatMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', text: fullText };
            return updated;
          });
        }
      );
    } catch (e: any) {
      setChatMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          text: 'Scuze, a apărut o eroare la conectarea cu asistentul. Reîncearcă.',
        };
        return updated;
      });
    } finally {
      setIsChatStreaming(false);
    }
  }, [isChatStreaming, chatMessages]);

  const handleChatSend = () => sendChatMessage(chatInput.trim());
  const handleSuggestedQ = (q: string) => sendChatMessage(q);

  // ─── Filtrare date grafic (tăiem pentru performanță: maxim 1 punct/trimestru) ──

  const sampledData = chartData.filter((_, i) => i % 3 === 0 || i >= chartData.length - 8);

  // ─── Verdict level styling ────────────────────────────────────────────────

  const verdictConfig = {
    bun: { bg: 'bg-emerald-900', border: 'border-emerald-800', text: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', emoji: '🟢' },
    moderat: { bg: 'bg-amber-900', border: 'border-amber-800', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', emoji: '🟡' },
    asteapta: { bg: 'bg-rose-900', border: 'border-rose-800', text: 'text-rose-300', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30', emoji: '🔴' },
  };
  const vc = forecast ? verdictConfig[forecast.verdictLevel] : verdictConfig.moderat;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-buildorange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Se încarcă datele INSSE CNS107D...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto">
          <p className="text-red-700 text-lg font-semibold mb-2">Eroare la încărcarea datelor</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const rezData = summary?.latestValues.rezidential as LatestValue | undefined;
  const nrezData = summary?.latestValues.nerezidential as LatestValue | undefined;
  const matData = summary?.latestValues.total_materiale as LatestValue | undefined;
  const totData = summary?.latestValues.total_cladiri as LatestValue | undefined;

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 pt-8 pb-6 max-w-screen-xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-buildorange text-xs font-bold uppercase tracking-widest">INSSE • CNS107D</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500 text-xs">Ian 2005 – Mar 2026 + Prognoze AI</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Analiza Pieței <span className="text-buildorange">Construcțiilor</span>
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Indici cost INSSE pentru România · Evoluție, impact inflație și prognoze 2027–2028</p>
          </div>
          <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-500 text-right">
            <p className="font-semibold text-slate-700">Sursa: INSSE</p>
            <p>Seria CNS107D — Indicii costului în construcții</p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 pb-16 space-y-8">

        {/* ─── HERO VERDICT ─────────────────────────────────────────────────── */}
        {forecast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`rounded-2xl border ${vc.bg} ${vc.border} p-6 shadow-lg`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border mb-3 ${vc.badge}`}>
                  {vc.emoji} VERDICT CURENT
                </div>
                <p className={`text-lg sm:text-xl font-semibold ${vc.text} leading-snug max-w-2xl`}>
                  {forecast.verdict}
                </p>
                <div className="flex items-start gap-1 mt-3 text-slate-500 text-[11px]">
                  <InfoIcon />
                  <span>{forecast.methodology}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── KPI GRID ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Rezidențial"
            value={rezData ? rezData.indexValue.toFixed(1) : '—'}
            yoy={rezData?.yoyChange ?? null}
            color="#60a5fa"
            subtitle={rezData ? `${MONTH_LABELS[rezData.month]} ${rezData.year}` : undefined}
          />
          <KpiCard
            label="Nerezidențial"
            value={nrezData ? nrezData.indexValue.toFixed(1) : '—'}
            yoy={nrezData?.yoyChange ?? null}
            color="#a78bfa"
            subtitle={nrezData ? `${MONTH_LABELS[nrezData.month]} ${nrezData.year}` : undefined}
          />
          <KpiCard
            label="Cost Materiale"
            value={matData ? matData.indexValue.toFixed(1) : '—'}
            yoy={matData?.yoyChange ?? null}
            color="#fbbf24"
            subtitle={matData ? `${MONTH_LABELS[matData.month]} ${matData.year}` : undefined}
          />
          <KpiCard
            label="Total Clădiri"
            value={totData ? totData.indexValue.toFixed(1) : '—'}
            yoy={totData?.yoyChange ?? null}
            color="#34d399"
            subtitle={totData ? `${MONTH_LABELS[totData.month]} ${totData.year}` : undefined}
          />
        </div>

        {/* ─── CHART ────────────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Evoluție Indici Cost</h2>
              <p className="text-slate-400 text-xs mt-0.5">Baza mobilă INSSE (Ian 2005 ≈ 38 → 2021 = 100)</p>
            </div>
            {/* Toggle serii */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'rezidential', label: 'Rezidențial', color: '#60a5fa' },
                { key: 'nerezidential', label: 'Nerezidențial', color: '#a78bfa' },
                { key: 'total_cladiri', label: 'Total Clădiri', color: '#34d399' },
                { key: 'total_materiale', label: 'Materiale', color: '#fbbf24' },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  id={`market-toggle-${key}`}
                  onClick={() => setSelectedCategories(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                    selectedCategories[key as keyof typeof selectedCategories]
                      ? 'text-white border-opacity-50'
                      : 'text-slate-500 border-slate-700 bg-transparent'
                  }`}
                  style={selectedCategories[key as keyof typeof selectedCategories]
                    ? { borderColor: color, backgroundColor: `${color}20`, color }
                    : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={sampledData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                interval={35}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={v => v.toFixed(0)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: '12px' }}
                formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
              />

              {/* Zona crizei 2022 */}
              <ReferenceArea
                x1="Mar 2022"
                x2="Sep 2022"
                fill="#ef4444"
                fillOpacity={0.06}
                stroke="#ef4444"
                strokeOpacity={0.2}
              />
              {/* Zona COVID */}
              <ReferenceArea
                x1="Mar 2020"
                x2="Dec 2020"
                fill="#a855f7"
                fillOpacity={0.06}
                stroke="#a855f7"
                strokeOpacity={0.2}
              />
              {/* Zona prognoze */}
              <ReferenceArea
                x1="Iun 2027"
                x2="Iun 2028"
                fill="#3b82f6"
                fillOpacity={0.04}
                stroke="#3b82f6"
                strokeOpacity={0.2}
                label={{ value: 'Prognoze AI', fill: '#3b82f6', fontSize: 10, position: 'insideTop' }}
              />

              {/* Linii de referință evenimente */}
              <ReferenceLine x="Ian 2008" stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.5}
                label={{ value: 'Max 2008', fill: '#f97316', fontSize: 9, position: 'top' }} />
              <ReferenceLine x="Ian 2022" stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5}
                label={{ value: 'Criză', fill: '#ef4444', fontSize: 9, position: 'top' }} />

              {/* Linii istorice */}
              {selectedCategories.rezidential && (
                <Line
                  type="monotone"
                  dataKey="rezidential"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  name="Rezidențial"
                  connectNulls={false}
                />
              )}
              {selectedCategories.nerezidential && (
                <Line
                  type="monotone"
                  dataKey="nerezidential"
                  stroke="#a78bfa"
                  strokeWidth={1.5}
                  dot={false}
                  name="Nerezidențial"
                  connectNulls={false}
                />
              )}
              {selectedCategories.total_cladiri && (
                <Line
                  type="monotone"
                  dataKey="total_cladiri"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  dot={false}
                  name="Total Clădiri"
                  connectNulls={false}
                />
              )}
              {selectedCategories.total_materiale && (
                <Line
                  type="monotone"
                  dataKey="total_materiale"
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="5 3"
                  name="Cost Materiale"
                  connectNulls={false}
                />
              )}

              {/* Linii prognoza — punctate, continue */}
              <Line
                type="monotone"
                dataKey="forecast_rezidential"
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={{ fill: '#60a5fa', r: 4 }}
                name="Prognoză Rezid."
                connectNulls
              />

              {/* Banda de incertitudine */}
              <Area
                type="monotone"
                dataKey="forecast_upper"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0.08}
                connectNulls
                name=""
              />
              <Area
                type="monotone"
                dataKey="forecast_lower"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0}
                connectNulls
                name=""
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ─── FORECAST CARDS ────────────────────────────────────────────────── */}
        {forecast && (
          <div>
            <h2 className="text-lg font-bold text-white mb-4">
              Prognoze AI <span className="text-slate-500 font-normal text-sm">— regresie liniară OLS pe ultimele 36 luni</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {forecast.years.map((fy, i) => (
                <ForecastCard
                  key={fy.year}
                  year={fy.year}
                  predicted={fy.predictedIndex}
                  lower={fy.lowerBound}
                  upper={fy.upperBound}
                  yoy={fy.yoyChangePercent}
                  isNear={i === 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── CHAT SECȚIUNEA ───────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          {/* Header chat */}
          <button
            id="market-chat-toggle"
            onClick={() => setChatOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/40 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <BrainIcon />
              </div>
              <div className="text-left">
                <p className="text-white font-semibold text-sm">Chat cu Analistul Financiar</p>
                <p className="text-slate-400 text-xs">Zidario AI · Context piață actualizat automat</p>
              </div>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-slate-400 transition-transform duration-300 ${chatOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          <AnimatePresence>
            {chatOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                {/* Întrebări sugerate */}
                {chatMessages.length === 0 && (
                  <div className="px-6 pt-4 pb-2">
                    <p className="text-slate-500 text-xs font-medium mb-3">ÎNTREBĂRI SUGERATE</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_QUESTIONS.map((q, i) => (
                        <button
                          key={i}
                          id={`market-suggested-q-${i}`}
                          onClick={() => handleSuggestedQ(q)}
                          disabled={isChatStreaming}
                          className="text-xs bg-slate-800 hover:bg-blue-900/40 border border-slate-700 hover:border-blue-600/50 text-slate-300 hover:text-blue-300 px-3 py-1.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mesaje */}
                {chatMessages.length > 0 && (
                  <div className="px-6 py-4 space-y-4 max-h-80 overflow-y-auto">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
                        }`}>
                          {msg.role === 'assistant' && msg.text === '' && isChatStreaming ? (
                            <div className="flex gap-1 items-center h-4">
                              {[0, 1, 2].map(dot => (
                                <motion.div
                                  key={dot}
                                  className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                                  animate={{ y: [0, -4, 0] }}
                                  transition={{ duration: 0.6, repeat: Infinity, delay: dot * 0.15 }}
                                />
                              ))}
                            </div>
                          ) : (
                            <p
                              className="whitespace-pre-wrap leading-relaxed"
                              dangerouslySetInnerHTML={{
                                __html: msg.text
                                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                  .replace(/\n/g, '<br />')
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}

                {/* Input */}
                <div className="px-6 pb-4 pt-2 flex gap-2 border-t border-slate-800">
                  <input
                    id="market-chat-input"
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChatSend())}
                    placeholder="Întreabă despre piața construcțiilor..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    disabled={isChatStreaming}
                    aria-label="Întrebare pentru agentul financiar Zidario"
                  />
                  <button
                    id="market-chat-send"
                    onClick={handleChatSend}
                    disabled={isChatStreaming || !chatInput.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Trimite întrebare"
                  >
                    <SendIcon />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── FOOTER NOTE ─────────────────────────────────────────────────── */}
        <div className="text-center text-slate-600 text-xs pb-4">
          <p>Date: INSSE — Institutul Național de Statistică, Seria CNS107D „Indicii costului în construcții" · Date publice ISSN</p>
          <p className="mt-1">Prognoze generate prin regresie liniară OLS pe date istorice — nu constituie consultanță financiară</p>
        </div>
      </div>
    </div>
  );
};
