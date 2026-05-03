import fs from 'fs';
import path from 'path';

let cache: string | null = null;

export const normativeCache = {
  /**
   * Încarcă fișierele statice (JSON-uri) în memorie ca un singur string.
   * Acesta constituie baza de cunoștințe (CAG) permanentă.
   */
  async load(): Promise<string> {
    if (cache) return cache;

    try {
      const p = (fn: string) => path.join(__dirname, '../../data', fn);
      
      const seismicTable = fs.readFileSync(p('seismic-zones.json'), 'utf-8');
      const frostTable = fs.readFileSync(p('frost-depth.json'), 'utf-8');
      const floorRules = fs.readFileSync(p('floor-rules.json'), 'utf-8');

      const minRooms = `Legea 114/1996: Cameră living min 18mp, dormitor min 9mp, baie min 3mp, înălțime liberă minim 2.55m.`;

      cache = `=== TABELE NORMATIVE STATICE ===\n\n` +
               `[Zone Seismice]\n${seismicTable}\n\n` +
               `[Adâncime Îngheț]\n${frostTable}\n\n` +
               `[Reguli Etaje și Fundații]\n${floorRules}\n\n` +
               `[Suprafețe Minime Locuințe]\n${minRooms}`;
      
      return cache;
    } catch (e: any) {
      console.error('Failed to load CAG normative cache:', e.message);
      return '';
    }
  }
};
