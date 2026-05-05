import fs from 'fs';
import path from 'path';

let cache: string | null = null;

export const normativeCache = {
  /**
   * CAG (Cache-Augmented Generation) — Baza de cunoaștere statică.
   *
   * Încarcă datele numerice/tabelate din JSON-uri și le combină
   * într-un singur string care este injectat în ORICE prompt AI.
   *
   * Regula de auruminclude DOAR date deterministe, mici (<5KB total):
   *  - Valori exacte per județ (ag, îngheț, zăpadă, vânt, costuri)
   *  - Suprafețe minime din lege (5 rânduri max)
   *
   * Textul explicativ (de ce există regula, cum se aplică)
   * se caută la runtime prin RAG, NU prin CAG.
   */
  async load(): Promise<string> {
    if (cache) return cache;

    try {
      const p = (fn: string) => path.join(__dirname, '../../data', fn);

      // P100-1/2013 — Zone seismice per județ (ag + Tc)
      const seismicTable = fs.readFileSync(p('seismic-zones.json'), 'utf-8');

      // NP112-2014 — Adâncime minimă de îngheț per județ
      const frostTable = fs.readFileSync(p('frost-depth.json'), 'utf-8');

      // Reguli etaje și adâncimi fundații per zonă seismică
      const floorRules = fs.readFileSync(p('floor-rules.json'), 'utf-8');

      // Legea 114/1996 — Suprafețe minime pentru locuințe
      const minRooms = `Legea 114/1996: Cameră living min 18mp, dormitor min 9mp, baie min 3mp, înălțime liberă minim 2.55m.`;

      // CR1-1-3/2012 — Zone zăpadă per județ (sk0 în kN/m²)
      // Valori caracteristice ale încărcării zăpezii la sol
      const snowZones = `CR1-1-3/2012 — Zone de zăpadă (sk0 kN/m²):
Alba:0.8, Arad:0.8, Argeș:1.2, Bacău:1.5, Bihor:0.8, Bistrița-Năsăud:1.5,
Botoșani:1.5, Brașov:1.5, Brăila:0.8, Buzău:1.2, Caraș-Severin:0.8,
Călărași:0.8, Cluj:1.2, Constanța:0.8, Covasna:1.5, Dâmbovița:1.2,
Dolj:0.8, Galați:0.8, Giurgiu:0.8, Gorj:1.2, Harghita:2.0,
Hunedoara:1.2, Ialomița:0.8, Iași:1.5, Ilfov:0.8, Maramureș:2.0,
Mehedinți:0.8, Mureș:1.5, Neamț:1.5, Olt:0.8, Prahova:1.2,
Satu Mare:1.2, Sălaj:1.2, Sibiu:1.5, Suceava:2.0, Teleorman:0.8,
Timiș:0.8, Tulcea:0.8, Vaslui:1.5, Vâlcea:1.2, Vrancea:1.2, București:0.8`;

      // CR1-1-4/2012 — Zone de vânt per județ (qb în kPa)
      // Presiunea de referință a vântului
      const windZones = `CR1-1-4/2012 — Zone de vânt (qb kPa):
Alba:0.5, Arad:0.5, Argeș:0.5, Bacău:0.7, Bihor:0.5, Bistrița-Năsăud:0.7,
Botoșani:0.7, Brașov:0.5, Brăila:0.7, Buzău:0.6, Caraș-Severin:0.5,
Călărași:0.7, Cluj:0.5, Constanța:0.9, Covasna:0.5, Dâmbovița:0.5,
Dolj:0.6, Galați:0.7, Giurgiu:0.7, Gorj:0.5, Harghita:0.5,
Hunedoara:0.5, Ialomița:0.7, Iași:0.7, Ilfov:0.7, Maramureș:0.5,
Mehedinți:0.6, Mureș:0.5, Neamț:0.7, Olt:0.6, Prahova:0.5,
Satu Mare:0.5, Sălaj:0.5, Sibiu:0.5, Suceava:0.7, Teleorman:0.7,
Timiș:0.5, Tulcea:0.9, Vaslui:0.7, Vâlcea:0.5, Vrancea:0.6, București:0.7`;

      // P91-INCERC — Coeficienți orientativi cost construcție (lei/mc)
      // Estimări pentru proiecte rezidențiale fără dotări speciale
      const buildCosts = `P91-INCERC — Costuri orientative construcție rezidențială (lei/mc, 2023):
Structură beton armat: 800-1100 lei/mc
Structură zidărie portantă: 650-900 lei/mc
Structură lemn: 700-950 lei/mc
Finisaje standard: +300-500 lei/mc
Finisaje premium: +600-900 lei/mc
Subsol: +30% față de prețul structurii
Mansardă: +20% față de etaj curent`;

      cache = `=== NORMATIVE STATICE CAG (date numerice exacte, referință fixă) ===\n\n` +
               `[P100-1/2013 — Zone Seismice per Județ]\n${seismicTable}\n\n` +
               `[NP112-2014 — Adâncime Îngheț per Județ]\n${frostTable}\n\n` +
               `[Reguli Etaje și Fundații]\n${floorRules}\n\n` +
               `[Legea 114/1996 — Suprafețe Minime Locuințe]\n${minRooms}\n\n` +
               `[CR1-1-3/2012 — Zone Zăpadă per Județ]\n${snowZones}\n\n` +
               `[CR1-1-4/2012 — Zone Vânt per Județ]\n${windZones}\n\n` +
               `[P91-INCERC — Costuri Orientative Construcție]\n${buildCosts}`;

      return cache;
    } catch (e: any) {
      console.error('[normativeCache] Eroare la încărcare CAG:', e.message);
      return '';
    }
  },

  /** Resetează cache-ul (util în teste sau la hot-reload) */
  clear(): void {
    cache = null;
  }
};
