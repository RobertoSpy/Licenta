/**
 * backend/src/modules/market/marketService.ts
 *
 * Business logic pentru Market Intelligence:
 *   - Formatare date istorice pentru grafice Recharts
 *   - Calcul prognoze via regresie liniară OLS (implementare nativă, fără ML libs)
 *   - Cache management (TTL 30 zile)
 *   - Generare text verdict via Gemini (non-streaming, scurt)
 */

import { marketRepository } from './marketRepository';
import { GoogleGenAI } from '@google/genai';
import { FALLBACK_MODELS_JSON } from '../ai/services/aiClient';

// ─── Constante ─────────────────────────────────────────────────────────────

/** Cache valid 30 zile — prognoza nu se schimbă semnificativ mai des */
const FORECAST_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Câte puncte lunare folosim pentru regresia OLS (ultimii 3 ani = 36 luni) */
const REGRESSION_WINDOW = 36;

// ─── Tipuri exportate ──────────────────────────────────────────────────────

export type MarketCategory =
  | 'rezidential'
  | 'nerezidential'
  | 'total_cladiri'
  | 'total_materiale';

export interface ChartDataPoint {
  /** Label afișat pe axa X: "Ian 2005" */
  label: string;
  year: number;
  month: number;
  rezidential?: number;
  nerezidential?: number;
  total_cladiri?: number;
  total_materiale?: number;
}

export interface ForecastYear {
  year: number;
  /** Valoarea predicționsă a indicelui rezidențial */
  predictedIndex: number;
  /** Limita inferioară a intervalului de încredere (±1.5 × RMSE) */
  lowerBound: number;
  /** Limita superioară a intervalului de încredere */
  upperBound: number;
  /** Variația față de media anului anterior (%) */
  yoyChangePercent: number;
}

export interface MarketForecastResponse {
  generatedAt: string;
  years: ForecastYear[];
  /** Text scurt generat de AI: verdict uman asupra momentului de construire */
  verdict: string;
  verdictLevel: 'bun' | 'moderat' | 'asteapta';
  /** Explicație metodologie pentru transparență */
  methodology: string;
}

export interface MarketSummaryResponse {
  /** Cel mai recent punct din fiecare categorie */
  latestValues: Record<MarketCategory, { year: number; month: number; indexValue: number; yoyChange: number | null }>;
  forecast: MarketForecastResponse;
  /** Text compactat pentru injectat ca context în chat agent financiar */
  contextString: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const MONTH_LABELS_RO = [
  '', 'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun',
  'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS_RO[month]} ${year}`;
}

/**
 * Regresie liniară OLS (Ordinary Least Squares) pe o serie de timp.
 * Returnează { slope, intercept, rmse } pentru extrapolarea prognozelor.
 *
 * @param values - Array de valori numerice (cronologic crescător)
 */
function linearRegression(values: number[]): { slope: number; intercept: number; rmse: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, rmse: 0 };

  // x = indexul timpului (0, 1, 2, ..., n-1)
  const xs = values.map((_, i) => i);
  const ys = values;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // RMSE — eroare pătratică medie ca bază pentru intervalul de incertitudine
  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const mse = residuals.reduce((acc, r) => acc + r * r, 0) / n;
  const rmse = Math.sqrt(mse);

  return { slope, intercept, rmse };
}

/**
 * Calculează variația YoY față de același punct cu 12 luni în urmă.
 */
function computeYoY(
  points: { year: number; month: number; indexValue: number }[],
  targetYear: number,
  targetMonth: number
): number | null {
  const current = points.find(p => p.year === targetYear && p.month === targetMonth);
  const prev = points.find(p => p.year === targetYear - 1 && p.month === targetMonth);
  if (!current || !prev || prev.indexValue === 0) return null;
  return ((current.indexValue - prev.indexValue) / prev.indexValue) * 100;
}

// ─── Service ───────────────────────────────────────────────────────────────

export const marketService = {
  /**
   * Returnează toate datele istorice formatate ca array de ChartDataPoint
   * pentru graficul Recharts (un obiect per lună, cu valorile tuturor categoriilor).
   */
  async getIndexHistory(): Promise<ChartDataPoint[]> {
    const all = await marketRepository.getAll();

    // Construim un Map { "2005-1" → ChartDataPoint }
    const map = new Map<string, ChartDataPoint>();

    for (const point of all) {
      const key = `${point.year}-${point.month}`;
      if (!map.has(key)) {
        map.set(key, {
          label: monthLabel(point.year, point.month),
          year: point.year,
          month: point.month,
        });
      }
      const entry = map.get(key)!;
      (entry as any)[point.category] = point.indexValue;
    }

    // Sortare cronologică
    return Array.from(map.values()).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );
  },

  /**
   * Returnează prognoza (din cache dacă valid, altfel generează și cachează).
   * Cache TTL: 30 zile.
   */
  async getForecast(): Promise<MarketForecastResponse> {
    // Verificăm cache-ul
    const cached = await marketRepository.getLatestForecast();
    if (cached) {
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      if (age < FORECAST_CACHE_TTL_MS) {
        return JSON.parse(cached.forecastJson) as MarketForecastResponse;
      }
    }

    // Generăm prognoza
    const forecast = await this._generateForecast();

    // Salvăm în cache
    await marketRepository.upsertForecast(
      JSON.stringify(forecast),
      FALLBACK_MODELS_JSON[0] ?? 'gemini-1.5-pro'
    );

    return forecast;
  },

  /**
   * Returnează rezumatul compact al pieței pentru injectarea în context chat.
   */
  async getSummary(): Promise<MarketSummaryResponse> {
    const categories: MarketCategory[] = [
      'rezidential', 'nerezidential', 'total_cladiri', 'total_materiale',
    ];

    const latestValues: MarketSummaryResponse['latestValues'] = {} as any;

    for (const cat of categories) {
      const points = await marketRepository.getByCategory(cat);
      const latest = points[points.length - 1];
      if (!latest) continue;

      const yoyChange = computeYoY(points, latest.year, latest.month);
      latestValues[cat] = {
        year: latest.year,
        month: latest.month,
        indexValue: latest.indexValue,
        yoyChange: yoyChange !== null ? Math.round(yoyChange * 10) / 10 : null,
      };
    }

    const forecast = await this.getForecast();

    // Context string compact pentru agentul financiar în chat
    const rezData = latestValues['rezidential'];
    const matData = latestValues['total_materiale'];
    const contextString = [
      `DATE PIAȚĂ CONSTRUCȚII (INSSE CNS107D, sursa oficială):`,
      `• Indice cost rezidențial ${MONTH_LABELS_RO[rezData?.month ?? 0]} ${rezData?.year}: ${rezData?.indexValue ?? 'N/A'} (față de baza 2005≈38; baza 2021=100)`,
      rezData?.yoyChange != null ? `• Variație YoY rezidențial: ${rezData.yoyChange > 0 ? '+' : ''}${rezData.yoyChange}%` : '',
      `• Indice cost materiale: ${matData?.indexValue ?? 'N/A'} (${matData?.yoyChange != null ? `${matData.yoyChange > 0 ? '+' : ''}${matData.yoyChange}% YoY` : 'N/A'})`,
      `• Context: Inflație mar 2026 = 9,9% YoY; manoperă indice 189,67 (baza 2021); energie +57,2%`,
      `PROGNOZE AI (regresie liniară OLS pe ultimii 36 luni):`,
      ...forecast.years.map((f: ForecastYear) =>
        `• ${f.year}: indice estimat ${f.predictedIndex.toFixed(1)} (interval: ${f.lowerBound.toFixed(1)}–${f.upperBound.toFixed(1)}), YoY ${f.yoyChangePercent > 0 ? '+' : ''}${f.yoyChangePercent.toFixed(1)}%`
      ),
      `VERDICT CURENT: ${forecast.verdict}`,
    ].filter(Boolean).join('\n');

    return { latestValues, forecast, contextString };
  },

  // ─── Private ──────────────────────────────────────────────────────────────

  async _generateForecast(): Promise<MarketForecastResponse> {
    // 1. Date pentru regresie — ultimele 36 luni rezidențiale
    const recentPoints = await marketRepository.getLastNPoints('rezidential', REGRESSION_WINDOW);
    const values = recentPoints.map(p => p.indexValue);

    const { slope, intercept, rmse } = linearRegression(values);

    // Ultimul punct cunoscut = baza de extrapolate
    const lastPoint = recentPoints[recentPoints.length - 1];
    const lastIdx = values.length - 1;

    // 2. Calculăm predicțiile pentru 2027 și 2028
    // Distanța în luni față de ultimul punct cunoscut
    const lastYear = lastPoint?.year ?? 2026;
    const lastMonth = lastPoint?.month ?? 3;

    const forecastYears: ForecastYear[] = [2027, 2028].map(targetYear => {
      // Estimăm luna 6 (medie an) pentru fiecare an prognozat
      const monthsAhead = (targetYear - lastYear) * 12 + (6 - lastMonth);
      const predictedIndex = intercept + slope * (lastIdx + monthsAhead);

      // Interval de incertitudine: ±1.5 × RMSE (crește cu distanța)
      const uncertaintyFactor = targetYear === 2027 ? 1.5 : 2.5;
      const uncertainty = rmse * uncertaintyFactor;

      // YoY față de anul anterior prognozat (sau ultimul an real)
      const prevYear = targetYear - 1;
      const prevMonthsAhead = (prevYear - lastYear) * 12 + (6 - lastMonth);
      const prevPredicted = prevMonthsAhead < 0
        ? (recentPoints[recentPoints.length + prevMonthsAhead]?.indexValue ?? predictedIndex / 1.05)
        : intercept + slope * (lastIdx + prevMonthsAhead);

      const yoyChangePercent = ((predictedIndex - prevPredicted) / prevPredicted) * 100;

      return {
        year: targetYear,
        predictedIndex: Math.round(predictedIndex * 10) / 10,
        lowerBound: Math.round((predictedIndex - uncertainty) * 10) / 10,
        upperBound: Math.round((predictedIndex + uncertainty) * 10) / 10,
        yoyChangePercent: Math.round(yoyChangePercent * 10) / 10,
      };
    });

    // 3. Generare verdict text via Gemini (scurt, non-streaming)
    const verdictText = await this._generateVerdictText(forecastYears, lastPoint?.indexValue ?? 161);
    const verdictLevel = this._computeVerdictLevel(forecastYears);

    return {
      generatedAt: new Date().toISOString(),
      years: forecastYears,
      verdict: verdictText,
      verdictLevel,
      methodology: `Regresie liniară OLS (Ordinary Least Squares) pe ultimele ${REGRESSION_WINDOW} luni de date INSSE CNS107D. Intervalul de incertitudine: ±${(1.5).toFixed(1)}×RMSE pentru 2027, ±${(2.5).toFixed(1)}×RMSE pentru 2028. Sursa date: INSSE, seria CNS107D "Indicii costului în construcții", categorie Clădiri rezidențiale.`,
    };
  },

  async _generateVerdictText(forecasts: ForecastYear[], currentIndex: number): Promise<string> {
    const prompt = `Ești un analist financiar specializat pe piața construcțiilor din România.
Pe baza datelor INSSE CNS107D:
- Indice cost rezidențial actual: ${currentIndex} (baza 2021=100)
- Prognoza 2027: ${forecasts[0]?.predictedIndex} (YoY: +${forecasts[0]?.yoyChangePercent}%)
- Prognoza 2028: ${forecasts[1]?.predictedIndex} (YoY: +${forecasts[1]?.yoyChangePercent}%)
- Context: inflația actuală în construcții ~9.9% YoY, manopera +89.67% față de 2021, materialele stabilizate la +42.7% față de 2021, energia electrică la niveluri ridicate (+57.2%)

Scrie UN SINGUR paragraf scurt (maxim 60 cuvinte) care explică utilizatorului dacă ACUM este un moment bun, moderat sau de așteptat pentru a începe construcția. Fii direct, bazat pe date, și menționează motivul principal.`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      for (const modelName of FALLBACK_MODELS_JSON) {
        try {
          const result = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: { maxOutputTokens: 120, temperature: 0.3 },
          });
          return result.text?.trim() ?? 'Momentul este moderat — costurile sunt ridicate dar stabile. Materialele s-au stabilizat, însă manopera continuă să crească.';
        } catch {
          continue;
        }
      }
    } catch {
      // Fallback static dacă AI e indisponibil
    }

    return 'Momentul este moderat — costurile sunt ridicate dar stabile. Materialele s-au stabilizat la +43% față de 2021, însă manopera continuă să crească (+90%). Amânarea nu aduce economii semnificative pe materiale.';
  },

  _computeVerdictLevel(forecasts: ForecastYear[]): 'bun' | 'moderat' | 'asteapta' {
    const yoy2027 = forecasts[0]?.yoyChangePercent ?? 5;
    if (yoy2027 < 3) return 'bun';
    if (yoy2027 < 8) return 'moderat';
    return 'asteapta';
  },
};
