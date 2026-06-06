/**
 * frontend/src/api/marketApi.ts
 *
 * Client API pentru Market Intelligence — date INSSE CNS107D, prognoze și rezumat.
 * Folosește `apiPrivate` (cu Bearer token automat din interceptorul axios.ts).
 */

import { apiPrivate } from './axios';

// ─── Tipuri ────────────────────────────────────────────────────────────────

export type MarketCategory =
  | 'rezidential'
  | 'nerezidential'
  | 'total_cladiri'
  | 'total_materiale';

/** Un punct de date formatat pentru grafic Recharts — câte un obiect per lună */
export interface ChartDataPoint {
  label: string;           // "Ian 2005"
  year: number;
  month: number;
  rezidential?: number;
  nerezidential?: number;
  total_cladiri?: number;
  total_materiale?: number;
  /** Prognoze extrapolate (undefined pentru punctele istorice) */
  forecast_rezidential?: number;
  forecast_lower?: number;
  forecast_upper?: number;
}

export interface ForecastYear {
  year: number;
  predictedIndex: number;
  lowerBound: number;
  upperBound: number;
  yoyChangePercent: number;
}

export interface MarketForecastResponse {
  generatedAt: string;
  years: ForecastYear[];
  verdict: string;
  verdictLevel: 'bun' | 'moderat' | 'asteapta';
  methodology: string;
}

export interface LatestValue {
  year: number;
  month: number;
  indexValue: number;
  yoyChange: number | null;
}

export interface MarketSummaryResponse {
  latestValues: Record<MarketCategory, LatestValue>;
  forecast: MarketForecastResponse;
  contextString: string;
}

// ─── API ───────────────────────────────────────────────────────────────────

export const marketApi = {
  /**
   * Returnează toate punctele istorice CNS107D formatate pentru grafice.
   * Response: { data: ChartDataPoint[] }
   */
  async getHistory(): Promise<{ data: ChartDataPoint[] }> {
    const res = await apiPrivate.get<{ data: ChartDataPoint[] }>('/market/history');
    return res.data;
  },

  /**
   * Returnează prognoza AI pentru 2027 / 2028 (cu cache 30 zile).
   */
  async getForecast(): Promise<MarketForecastResponse> {
    const res = await apiPrivate.get<MarketForecastResponse>('/market/forecast');
    return res.data;
  },

  /**
   * Returnează rezumatul compact: valorile curente + YoY + forecast + contextString.
   */
  async getSummary(): Promise<MarketSummaryResponse> {
    const res = await apiPrivate.get<MarketSummaryResponse>('/market/summary');
    return res.data;
  },
};
