"use strict";
/**
 * backend/src/modules/market/marketService.ts
 *
 * Business logic pentru Market Intelligence:
 *   - Formatare date istorice pentru grafice Recharts
 *   - Calcul prognoze via regresie liniară OLS (implementare nativă, fără ML libs)
 *   - Cache management (TTL 30 zile)
 *   - Generare text verdict via Gemini (non-streaming, scurt)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketService = void 0;
exports.linearRegression = linearRegression;
const marketRepository_1 = require("./marketRepository");
const genai_1 = require("@google/genai");
const aiClient_1 = require("../ai/services/aiClient");
const manual_market_context_json_1 = __importDefault(require("../../data/manual-market-context.json"));
// ─── Constante ─────────────────────────────────────────────────────────────
/** Cache valid 30 zile — prognoza nu se schimbă semnificativ mai des */
const FORECAST_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Câte puncte lunare folosim pentru regresia OLS (ultimii 3 ani = 36 luni) */
const REGRESSION_WINDOW = 36;
// ─── Helpers ───────────────────────────────────────────────────────────────
const MONTH_LABELS_RO = [
    '', 'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun',
    'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
function monthLabel(year, month) {
    return `${MONTH_LABELS_RO[month]} ${year}`;
}
/**
 * Regresie liniară OLS (Ordinary Least Squares) pe o serie de timp.
 * Returnează { slope, intercept, rmse } pentru extrapolarea prognozelor.
 *
 * @param values - Array de valori numerice (cronologic crescător)
 */
function linearRegression(values) {
    const n = values.length;
    if (n < 2)
        throw new Error('Nu există suficiente date pentru regresie liniară (minim 2 puncte necesare).');
    // x = indexul timpului (0, 1, 2, ..., n-1)
    const xs = values.map((_, i) => i);
    const ys = values;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
    const denominator = (n * sumXX - sumX * sumX);
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
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
function computeYoY(points, targetYear, targetMonth) {
    const current = points.find(p => p.year === targetYear && p.month === targetMonth);
    const prev = points.find(p => p.year === targetYear - 1 && p.month === targetMonth);
    if (!current || !prev || prev.indexValue === 0)
        return null;
    return ((current.indexValue - prev.indexValue) / prev.indexValue) * 100;
}
// ─── Service ───────────────────────────────────────────────────────────────
exports.marketService = {
    /**
     * Returnează toate datele istorice formatate ca array de ChartDataPoint
     * pentru graficul Recharts (un obiect per lună, cu valorile tuturor categoriilor).
     */
    getIndexHistory() {
        return __awaiter(this, void 0, void 0, function* () {
            const all = yield marketRepository_1.marketRepository.getAll();
            // Construim un Map { "2005-1" → ChartDataPoint }
            const map = new Map();
            for (const point of all) {
                const key = `${point.year}-${point.month}`;
                if (!map.has(key)) {
                    map.set(key, {
                        label: monthLabel(point.year, point.month),
                        year: point.year,
                        month: point.month,
                    });
                }
                const entry = map.get(key);
                entry[point.category] = point.indexValue;
            }
            // Sortare cronologică
            return Array.from(map.values()).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
        });
    },
    /**
     * Returnează prognoza (din cache dacă valid, altfel generează și cachează).
     * Cache TTL: 30 zile.
     */
    getForecast() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Verificăm cache-ul
            const cached = yield marketRepository_1.marketRepository.getLatestForecast();
            if (cached) {
                const age = Date.now() - new Date(cached.generatedAt).getTime();
                // TTL calculation boundary: valid if age < TTL. If age == TTL, it's expired.
                if (age < FORECAST_CACHE_TTL_MS) {
                    try {
                        return JSON.parse(cached.forecastJson);
                    }
                    catch (e) {
                        console.warn('[marketService.getForecast] Cache JSON corupt, regenerăm...');
                        // Fall through to regeneration
                    }
                }
            }
            // Generăm prognoza
            const forecast = yield this._generateForecast();
            // Salvăm în cache
            yield marketRepository_1.marketRepository.upsertForecast(JSON.stringify(forecast), (_a = aiClient_1.FALLBACK_MODELS_JSON[0]) !== null && _a !== void 0 ? _a : 'gemini-1.5-pro');
            return forecast;
        });
    },
    /**
     * Returnează rezumatul compact al pieței pentru injectarea în context chat.
     */
    getSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const categories = [
                'rezidential', 'nerezidential', 'total_cladiri', 'total_materiale',
            ];
            const latestValues = {};
            const [rezPoints, nerezPoints, cladiriPoints, materialePoints] = yield Promise.all(categories.map(cat => marketRepository_1.marketRepository.getByCategory(cat)));
            const pointsArray = [rezPoints, nerezPoints, cladiriPoints, materialePoints];
            for (let i = 0; i < categories.length; i++) {
                const cat = categories[i];
                const points = pointsArray[i];
                const latest = points[points.length - 1];
                if (!latest)
                    continue;
                const yoyChange = computeYoY(points, latest.year, latest.month);
                latestValues[cat] = {
                    year: latest.year,
                    month: latest.month,
                    indexValue: latest.indexValue,
                    yoyChange: yoyChange !== null ? Math.round(yoyChange * 10) / 10 : null,
                };
            }
            const forecast = yield this.getForecast();
            // Context string compact pentru agentul financiar în chat
            const rezData = latestValues['rezidential'];
            const matData = latestValues['total_materiale'];
            const contextString = [
                `DATE PIAȚĂ CONSTRUCȚII (INSSE CNS107D, sursa oficială):`,
                `• Indice cost rezidențial ${MONTH_LABELS_RO[(_a = rezData === null || rezData === void 0 ? void 0 : rezData.month) !== null && _a !== void 0 ? _a : 0]} ${rezData === null || rezData === void 0 ? void 0 : rezData.year}: ${(_b = rezData === null || rezData === void 0 ? void 0 : rezData.indexValue) !== null && _b !== void 0 ? _b : 'N/A'} (față de baza 2005≈38; baza 2021=100)`,
                (rezData === null || rezData === void 0 ? void 0 : rezData.yoyChange) != null ? `• Variație YoY rezidențial: ${rezData.yoyChange > 0 ? '+' : ''}${rezData.yoyChange}%` : '',
                `• Indice cost materiale: ${(_c = matData === null || matData === void 0 ? void 0 : matData.indexValue) !== null && _c !== void 0 ? _c : 'N/A'} (${(matData === null || matData === void 0 ? void 0 : matData.yoyChange) != null ? `${matData.yoyChange > 0 ? '+' : ''}${matData.yoyChange}% YoY` : 'N/A'})`,
                `• Context: Inflație = ${(rezData === null || rezData === void 0 ? void 0 : rezData.yoyChange) != null ? rezData.yoyChange + '%' : 'N/A'} YoY; Manoperă: +${manual_market_context_json_1.default.laborIndexVsBase2021}% (baza 2021); Energie: +${manual_market_context_json_1.default.energyIndexVsBase2021}% (baza 2021)`,
                `PROGNOZE AI (regresie liniară OLS pe ultimii 36 luni):`,
                ...forecast.years.map((f) => `• ${f.year}: indice estimat ${f.predictedIndex.toFixed(1)} (interval: ${f.lowerBound.toFixed(1)}–${f.upperBound.toFixed(1)}), YoY ${f.yoyChangePercent > 0 ? '+' : ''}${f.yoyChangePercent.toFixed(1)}%`),
                `VERDICT CURENT: ${forecast.verdict}`,
            ].filter(Boolean).join('\n');
            return { latestValues, forecast, contextString };
        });
    },
    // ─── Private ──────────────────────────────────────────────────────────────
    _generateForecast() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            // 1. Date pentru regresie — ultimele 36 luni rezidențiale
            const recentPoints = yield marketRepository_1.marketRepository.getLastNPoints('rezidential', REGRESSION_WINDOW);
            const cladiriPoints = yield marketRepository_1.marketRepository.getLastNPoints('total_cladiri', 13);
            const materialePoints = yield marketRepository_1.marketRepository.getLastNPoints('total_materiale', 1);
            if (recentPoints.length < 2) {
                throw new Error('NOT_ENOUGH_DATA');
            }
            const values = recentPoints.map(p => p.indexValue);
            const { slope, intercept, rmse } = linearRegression(values);
            // Ultimul punct cunoscut = baza de extrapolate
            const lastPoint = recentPoints[recentPoints.length - 1];
            const lastIdx = values.length - 1;
            // 2. Calculăm predicțiile pentru 2027 și 2028
            // Distanța în luni față de ultimul punct cunoscut
            const lastYear = (_a = lastPoint === null || lastPoint === void 0 ? void 0 : lastPoint.year) !== null && _a !== void 0 ? _a : 2026;
            const lastMonth = (_b = lastPoint === null || lastPoint === void 0 ? void 0 : lastPoint.month) !== null && _b !== void 0 ? _b : 3;
            const forecastYears = [2027, 2028].map(targetYear => {
                var _a, _b, _c;
                // Estimăm luna 6 (medie an) pentru fiecare an prognozat
                const monthsAhead = (targetYear - lastYear) * 12 + (6 - lastMonth);
                const predictedIndex = intercept + slope * (lastIdx + monthsAhead);
                // Interval de incertitudine: ±1.5 × RMSE (crește cu distanța)
                const uncertaintyFactor = targetYear === 2027 ? 1.5 : 2.5;
                const uncertainty = rmse * uncertaintyFactor;
                // YoY față de anul anterior prognozat (sau ultimul an real)
                const prevYear = targetYear - 1;
                const prevMonthsAhead = (prevYear - lastYear) * 12 + (6 - lastMonth);
                const prevPredicted = prevMonthsAhead <= 0
                    ? (_c = (_b = ((_a = recentPoints.at(prevMonthsAhead)) !== null && _a !== void 0 ? _a : recentPoints.at(-1))) === null || _b === void 0 ? void 0 : _b.indexValue) !== null && _c !== void 0 ? _c : predictedIndex
                    : intercept + slope * (lastIdx + prevMonthsAhead);
                const yoyChangePercent = prevPredicted !== 0
                    ? ((predictedIndex - prevPredicted) / prevPredicted) * 100
                    : 0;
                // Prevent negative prices/indices in absurd extrapolation scenarios
                const safePredictedIndex = Math.max(0, predictedIndex);
                const safeLowerBound = Math.max(0, predictedIndex - uncertainty);
                const safeUpperBound = Math.max(0, predictedIndex + uncertainty);
                return {
                    year: targetYear,
                    predictedIndex: Math.round(safePredictedIndex * 10) / 10,
                    lowerBound: Math.round(safeLowerBound * 10) / 10,
                    upperBound: Math.round(safeUpperBound * 10) / 10,
                    yoyChangePercent: Math.round(yoyChangePercent * 10) / 10,
                };
            });
            // 3. Extragere macro context
            const latestCladiri = cladiriPoints[cladiriPoints.length - 1];
            const inflationYoY = latestCladiri ? computeYoY(cladiriPoints, latestCladiri.year, latestCladiri.month) : null;
            const latestMateriale = (_d = (_c = materialePoints[0]) === null || _c === void 0 ? void 0 : _c.indexValue) !== null && _d !== void 0 ? _d : 100;
            const materialeBase2021 = latestMateriale - 100; // bază 2021=100
            // 4. Generare verdict text via Gemini (scurt, non-streaming)
            const verdictText = yield this._generateVerdictText(forecastYears, (_e = lastPoint === null || lastPoint === void 0 ? void 0 : lastPoint.indexValue) !== null && _e !== void 0 ? _e : 161, {
                inflationYoY: inflationYoY !== null ? Math.round(inflationYoY * 10) / 10 : null,
                materialeBase2021
            });
            const verdictLevel = this._computeVerdictLevel(forecastYears);
            return {
                generatedAt: new Date().toISOString(),
                years: forecastYears,
                verdict: verdictText,
                verdictLevel,
                methodology: `Regresie liniară OLS (Ordinary Least Squares) pe ultimele ${REGRESSION_WINDOW} luni de date INSSE CNS107D. Intervalul de incertitudine: ±${(1.5).toFixed(1)}×RMSE pentru 2027, ±${(2.5).toFixed(1)}×RMSE pentru 2028. Sursa date: INSSE, seria CNS107D "Indicii costului în construcții", categorie Clădiri rezidențiale.`,
            };
        });
    },
    _generateVerdictText(forecasts, currentIndex, macroContext) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const prompt = `Ești un analist financiar specializat pe piața construcțiilor din România.
Pe baza datelor INSSE CNS107D:
- Indice cost rezidențial actual: ${currentIndex} (baza 2021=100)
- Prognoza 2027: ${(_a = forecasts[0]) === null || _a === void 0 ? void 0 : _a.predictedIndex} (YoY: +${(_b = forecasts[0]) === null || _b === void 0 ? void 0 : _b.yoyChangePercent}%)
- Prognoza 2028: ${(_c = forecasts[1]) === null || _c === void 0 ? void 0 : _c.predictedIndex} (YoY: +${(_d = forecasts[1]) === null || _d === void 0 ? void 0 : _d.yoyChangePercent}%)
- Context macroeconomic: Inflația generală a construcțiilor este la ${macroContext.inflationYoY ? '+' + macroContext.inflationYoY : '~10'}% YoY. Materialele au atins pragul de +${macroContext.materialeBase2021.toFixed(1)}% față de 2021.
- Manoperă în construcții: +${manual_market_context_json_1.default.laborIndexVsBase2021}% față de baza 2021
- Energie: +${manual_market_context_json_1.default.energyIndexVsBase2021}% față de baza 2021
  (Sursa date externe: ${manual_market_context_json_1.default._source}, ${manual_market_context_json_1.default._lastUpdated})

Scrie UN SINGUR paragraf scurt (maxim 60 cuvinte) care explică utilizatorului dacă ACUM este un moment bun, moderat sau de așteptat pentru a începe construcția. Fii direct, bazat pe date, și menționează motivul principal.`;
            try {
                const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                for (const modelName of aiClient_1.FALLBACK_MODELS_JSON) {
                    try {
                        const result = yield ai.models.generateContent({
                            model: modelName,
                            contents: prompt,
                            config: { maxOutputTokens: 120, temperature: 0.3 },
                        });
                        const text = ((_e = result.text) === null || _e === void 0 ? void 0 : _e.trim()) || '';
                        if (text === '')
                            throw new Error('Empty AI response');
                        return text;
                    }
                    catch (_f) {
                        continue;
                    }
                }
            }
            catch (_g) {
                // Fallback static dacă AI e indisponibil
            }
            return 'Momentul este moderat — costurile sunt ridicate dar stabile. Materialele s-au stabilizat la +43% față de 2021, însă manopera continuă să crească (+90%). Amânarea nu aduce economii semnificative pe materiale.';
        });
    },
    _computeVerdictLevel(forecasts) {
        var _a, _b;
        const yoy2027 = (_b = (_a = forecasts[0]) === null || _a === void 0 ? void 0 : _a.yoyChangePercent) !== null && _b !== void 0 ? _b : 5;
        if (yoy2027 < 3)
            return 'bun';
        if (yoy2027 < 8)
            return 'moderat';
        return 'asteapta';
    },
};
