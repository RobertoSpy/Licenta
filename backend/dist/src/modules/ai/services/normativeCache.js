"use strict";
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
exports.normativeCache = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let cache = null;
exports.normativeCache = {
    /**
     * CAG (Cache-Augmented Generation) — Baza de cunoaștere statică.
     *
     * Încarcă datele numerice/tabelate din JSON-uri și le combină
     * într-un singur string care este injectat în ORICE prompt AI.
     *
     * Regula de aur: include DOAR date deterministe, mici (<5KB total):
     *  - Valori exacte per județ (ag, îngheț, zăpadă, vânt, costuri)
     *  - Suprafețe minime din lege (câteva rânduri)
     *
     * Textul explicativ (de ce există regula, cum se aplică)
     * se caută la runtime prin RAG, NU prin CAG.
     */
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            if (cache)
                return cache;
            try {
                const p = (fn) => path_1.default.join(__dirname, '../../../data', fn);
                const readJson = (fn) => fs_1.default.readFileSync(p(fn), 'utf-8');
                // P100-1/2013 — Zone seismice per județ (ag + Tc)
                const seismicTable = readJson('seismic-zones.json');
                // NP112-2014 — Adâncime minimă de îngheț per județ
                const frostTable = readJson('frost-depth.json');
                // P100-1/2013 + NP112-2014 — Etaje maxime per zonă seismică și tip sol
                const floorRules = readJson('floor-rules.json');
                // CR1-1-3/2012 — Zone zăpadă per județ (sk0 în kN/m²)
                const snowZones = readJson('snow-zones.json');
                // CR1-1-4/2012 — Zone de vânt per județ (qb în kPa)
                const windZones = readJson('wind-zones.json');
                const cacheContent = `=== NORMATIVE STATICE CAG (date numerice exacte, referință fixă) ===\n\n` +
                    `[P100-1/2013 — Zone Seismice per Județ]\n${seismicTable}\n\n` +
                    `[NP112-2014 — Adâncime Îngheț per Județ]\n${frostTable}\n\n` +
                    `[P100-1/2013 + NP112-2014 — Etaje Maxime per Zonă Seismică și Tip Sol]\n${floorRules}\n\n` +
                    `[CR1-1-3/2012 — Zone Zăpadă per Județ (sk0 kN/m²)]\n${snowZones}\n\n` +
                    `[CR1-1-4/2012 — Zone Vânt per Județ (qb kPa)]\n${windZones}\n\n`;
                cache = cacheContent;
                return cache;
            }
            catch (e) {
                console.error('[normativeCache] Eroare la încărcare CAG:', e.message);
                return '';
            }
        });
    },
    /** Resetează cache-ul (util în teste sau la hot-reload) */
    clear() {
        cache = null;
    }
};
