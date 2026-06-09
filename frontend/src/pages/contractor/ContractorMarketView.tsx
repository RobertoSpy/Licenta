/**
 * frontend/src/pages/contractor/ContractorMarketView.tsx
 *
 * Dashboard de piață pentru constructor:
 *  - Proiectele mele acceptate (cele pe care lucrez sau am câștigat oferta)
 *  - Analiza Pieței (indici INSSE CNS107D) — să vadă concurența și tendințele
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiPrivate } from '../../api/axios';
import { marketApi } from '../../api/marketApi';
import type { MarketSummaryResponse, LatestValue } from '../../api/marketApi';
import {
  TrendingUp, TrendingDown, MapPin, Calendar, CheckCircle,
  Users, BarChart3, AlertCircle, Building2, Activity
} from 'lucide-react';

interface AcceptedProject {
  id: number;
  name: string;
  county: string | null;
  buildingPurpose: string | null;
  totalArea: number | null;
  createdAt: string;
  user: { name: string | null; email: string };
  totalAmount?: number;
}

const MONTH_LABELS = ['', 'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ContractorMarketView() {
  const [projects, setProjects] = useState<AcceptedProject[]>([]);
  const [summary, setSummary] = useState<MarketSummaryResponse | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingMarket, setLoadingMarket] = useState(true);

  useEffect(() => {
    // Fetch proiectele câștigate (oferte ACCEPTED)
    apiPrivate.get('/contractors/me/accepted-projects')
      .then(res => setProjects(res.data))
      .catch(err => {
        console.error('Eroare la proiecte acceptate:', err);
        setProjects([]);
      })
      .finally(() => setLoadingProjects(false));

    // Fetch date piață
    marketApi.getSummary()
      .then(data => setSummary(data))
      .catch(err => console.error('Eroare la summary piață:', err))
      .finally(() => setLoadingMarket(false));
  }, []);

  const rezData = summary?.latestValues.rezidential as LatestValue | undefined;
  const nrezData = summary?.latestValues.nerezidential as LatestValue | undefined;
  const matData = summary?.latestValues.total_materiale as LatestValue | undefined;

  return (
    <div className="space-y-8 max-w-7xl">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Piață & Proiectele Mele</h1>
        <p className="text-slate-500 mt-1">Proiectele câștigate și indicii de piață pentru a rămâne competitiv.</p>
      </div>

      {/* === SECȚIUNEA 1: Proiectele Mele Câștigate === */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-buildorange/10 text-buildorange rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Proiectele Mele Active</h2>
            <p className="text-sm text-slate-400">Proiecte pentru care oferta ta a fost acceptată</p>
          </div>
        </div>

        {loadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Nu ai proiecte active încă</h3>
            <p className="text-slate-500 text-sm">
              Proiectele pentru care oferta ta a fost acceptată de un client vor apărea aici.
              Mergi la <strong>Cereri & Oferte</strong> pentru a vedea lead-urile disponibile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-buildorange/50 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                    CÂȘTIGAT
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 mb-1 truncate">
                  {project.name || `Proiect #${project.id}`}
                </h3>
                <p className="text-sm text-slate-500 mb-3">
                  Client: <span className="font-medium text-slate-700">{project.user.name || project.user.email}</span>
                </p>

                <div className="space-y-1.5 text-xs text-slate-500">
                  {project.county && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-buildorange" />
                      {project.county}
                    </div>
                  )}
                  {project.buildingPurpose && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {project.buildingPurpose}
                      {project.totalArea ? ` · ${project.totalArea} m²` : ''}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(project.createdAt).toLocaleDateString('ro-RO')}
                  </div>
                </div>

                {project.totalAmount && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400">Valoare contractată</p>
                    <p className="text-lg font-black text-buildorange">
                      {project.totalAmount.toLocaleString('ro-RO')} RON
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* === SECȚIUNEA 2: Indicii de Piață (INSSE) === */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Indicii Pieței Construcțiilor</h2>
            <p className="text-sm text-slate-400">Date INSSE CNS107D — pentru a-ți calibra ofertele față de piață</p>
          </div>
        </div>

        {loadingMarket ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Indice Rezidențial',
                data: rezData,
                color: 'text-buildorange',
                bg: 'bg-buildorange/10',
                border: 'border-buildorange/20',
                icon: <Building2 className="w-5 h-5" />
              },
              {
                label: 'Indice Nerezidențial',
                data: nrezData,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                icon: <BarChart3 className="w-5 h-5" />
              },
              {
                label: 'Cost Materiale',
                data: matData,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                border: 'border-emerald-200',
                icon: <TrendingUp className="w-5 h-5" />
              },
            ].map((kpi) => (
              <div key={kpi.label} className={`bg-white border ${kpi.border} rounded-2xl p-6`}>
                <div className={`w-10 h-10 ${kpi.bg} ${kpi.color} rounded-xl flex items-center justify-center mb-4`}>
                  {kpi.icon}
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                <p className={`text-3xl font-black ${kpi.color}`}>
                  {kpi.data ? kpi.data.indexValue.toFixed(1) : '—'}
                </p>
                {kpi.data && (
                  <>
                    <p className="text-xs text-slate-400 mt-1">
                      {MONTH_LABELS[kpi.data.month]} {kpi.data.year}
                    </p>
                    {kpi.data.yoyChange != null && (
                      <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
                        kpi.data.yoyChange > 0 ? 'text-rose-500' : 'text-emerald-600'
                      }`}>
                        {kpi.data.yoyChange > 0
                          ? <TrendingUp className="w-3.5 h-3.5" />
                          : <TrendingDown className="w-3.5 h-3.5" />
                        }
                        {kpi.data.yoyChange > 0 ? '+' : ''}{kpi.data.yoyChange.toFixed(1)}% față de an anterior
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-buildorange" />
            Ce înseamnă pentru tine ca și constructor?
          </h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-buildorange font-bold mt-0.5">→</span>
              <span>Un indice rezidențial ridicat înseamnă că materialele și manopera sunt mai scumpe — ajustează-ți ofertele corespunzător.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-buildorange font-bold mt-0.5">→</span>
              <span>Indexul de materiale îți arată dacă trebuie să recalculezi prețurile pentru proiectele aflate în derulare.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-buildorange font-bold mt-0.5">→</span>
              <span>Clienții cu proiecte planificate cu Zidario sunt <strong>lead-uri calificate</strong> — au deja devizul BOM generat și bugetul estimat.</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
