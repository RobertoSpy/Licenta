// backend/src/data/normative-registry.ts
//
// SURSA UNICĂ DE ADEVĂR pentru configurația normativelor.
// Atât seedNormatives.ts cât și ragService.ts importă din acest fișier.
// Nu duplica această informație în altă parte.
//
// Pentru a adăuga un normativ nou:
//   1. Adaugă intrarea în NORMATIVE_REGISTRY
//   2. Adaugă filename-ul în NORMATIVE_FILES
//   3. Adaugă sursa în AGENT_SOURCES pentru agentul corespunzător
//   4. Re-rulează: npm run seed:normatives

// ─────────────────────────────────────────────────────────────────
// TIPURI
// ─────────────────────────────────────────────────────────────────

/**
 * Tipurile de agenți RAG din sistem.
 *
 * ACTIVI (au chunks indexate în DB după seed):
 *   geotehnic    — NP112-2014, NP074-2022, P100-1-2013 (secțiuni fundații)
 *   seismic      — P100-1-2013
 *   structural   — CR6-2013, NE012-1-2022, P100-1-2013, CR1-1-4-2012, P118-99
 *   architectural— CR1-1-4-2012, P100-1-2013, Legea350-2001, P118-99
 *   legal        — Legea114-1996, Legea50-1991, Legea10-1995
 *   general      — fallback fără filtru de agent, caută în tot ce e indexat
 *
 * PHASE 3 (AGENT_SOURCES gol — searchHybrid returnează [] fără apel DB):
 *   materiale    — catalog prețuri Leroy Merlin / Dedeman (web-scraping Faza 3)
 *   deviz        — estimare costuri per mc (Faza 3)
 */
export type AgentType =
  | 'geotehnic'
  | 'seismic'
  | 'structural'
  | 'architectural'
  | 'legal'
  | 'general'
  | 'materiale'  // Phase 3 placeholder — AGENT_SOURCES gol, nu face query DB
  | 'deviz';     // Phase 3 placeholder — AGENT_SOURCES gol, nu face query DB

export interface NormativeConfig {
  defaultAgent: AgentType;
  // Secțiuni de SĂRIT la seed — sunt tabele numerice deja în JSON-urile CAG
  // (seismic-zones.json, frost-depth.json, wind-zones.json, snow-zones.json)
  skipPatterns: RegExp[];
  // Reguli de routing: dacă titlul/conținutul secțiunii matches pattern → agent
  // Prima regulă care dă match câștigă
  agentRules: { pattern: RegExp; agent: AgentType }[];
}

// ─────────────────────────────────────────────────────────────────
// REGISTRY — configurație per normativ
// ─────────────────────────────────────────────────────────────────

export const NORMATIVE_REGISTRY: Record<string, NormativeConfig> = {
  'P100-1-2013': {
    defaultAgent: 'seismic',
    skipPatterns: [
      /Anexa\s*A/i, // tabelul ag/Tc per județ — e în seismic-zones.json
      /Anexa\s*B/i, // spectrul de răspuns elastic — valori numerice pure
    ],
    agentRules: [
      { pattern: /amplasament|zonare|teritoriu|județ|localitate|hartă/i,          agent: 'seismic' },
      { pattern: /regularitate|simetrie|clasa de importanță|factor.*importanță/i,  agent: 'architectural' },
      { pattern: /zidărie|beton armat|ductilitate|DCH|DCM|ZIA|ZNA|ZC|armare/i,    agent: 'structural' },
      { pattern: /fundație|teren de fundare|litologie|stratificare/i,              agent: 'geotehnic' },
    ],
  },

  'NP112-2014': {
    defaultAgent: 'geotehnic',
    skipPatterns: [
      /Anexa\s*B/i, // tabelul adâncime îngheț per județ — e în frost-depth.json
    ],
    agentRules: [
      { pattern: /identificare.*sol|tip.*teren|argilos|nisipos|pietros|stâncos|coeziv/i, agent: 'geotehnic' },
      { pattern: /fundație|adâncime.*fundare|presiune.*teren|capacitate portantă/i,       agent: 'geotehnic' },
    ],
  },

  'CR6-2013': {
    defaultAgent: 'structural',
    skipPatterns: [], // CR6 este 100% text tehnic — nimic nu e în JSON
    agentRules: [
      { pattern: /zidărie nearmată|ZNA/i,                                          agent: 'structural' },
      { pattern: /zidărie confinată|ZC\b/i,                                        agent: 'structural' },
      { pattern: /zidărie cu inimă armată|ZIA/i,                                   agent: 'structural' },
      { pattern: /grosime.*perete|perete.*structural|dimensionare/i,               agent: 'structural' },
    ],
  },

  'NE012-1-2022': {
    defaultAgent: 'structural',
    skipPatterns: [],
    agentRules: [
      // Clase de expunere XF = îngheț/dezgheț → routing explicit la structural
      // (bomService.ts folosește frostDepthCm deterministic, RAG explică de ce)
      { pattern: /beton|armătură|cofraj|turnare|rezistență caracteristică|clasa.*beton|C\d{2}/i, agent: 'structural' },
      { pattern: /expunere.*îngheț|XF\d|XC\d|mediu agresiv|durabilitate/i,                      agent: 'structural' },
      { pattern: /fundație|radier|subsol/i,                                                       agent: 'geotehnic' },
    ],
  },

  'CR1-1-4-2012': {
    defaultAgent: 'structural',
    skipPatterns: [
      /Anexa\s*A/i, // tabelul qb/vb per județ — e în wind-zones.json
    ],
    agentRules: [
      { pattern: /categori.*teren|rugozitate|expunere la vânt/i,                   agent: 'architectural' },
      { pattern: /acoperiș|suțiune|smulgere|coeficient.*presiune|cpe\b|cpj\b/i,   agent: 'structural' },
    ],
  },

  'Legea114-1996': {
    defaultAgent: 'legal',
    skipPatterns: [],
    agentRules: [
      { pattern: /suprafață|cameră|living|dormitor|baie|bucătărie|hol|debara/i,    agent: 'legal' },
    ],
  },

  'Legea50-1991': {
    defaultAgent: 'legal',
    skipPatterns: [],
    agentRules: [
      // DTAC = Documentație Tehnică pentru Autorizație de Construire
      // AC = Autorizație de Construire
      { pattern: /autorizație|certificat.*urbanism|aviz|DTAC|\bAC\b|construire|demolare/i, agent: 'legal' },
      // Art. 11 — lucrări care nu necesită autorizație (garduri, reparații minore etc.)
      { pattern: /excepții|fără.*autorizație|art.*11|lucrări.*scutite/i,                   agent: 'legal' },
    ],
  },

  'Legea10-1995': {
    defaultAgent: 'legal',
    skipPatterns: [],
    agentRules: [
      // Cele 6 cerințe fundamentale — text explicativ, nu date numerice
      { pattern: /cerință.*fundamentală|rezistență mecanică|securitate.*incendiu|igienă|sănătate|zgomot|economie.*energie/i, agent: 'legal' },
      // Responsabilități tehnice → routing la structural (diriginte, ISC, carte tehnică)
      { pattern: /diriginte.*șantier|responsabil.*tehnic|recepție|carte.*tehnică|\bISC\b|verificator.*proiect/i,           agent: 'structural' },
    ],
  },

  'NP074-2022': {
    defaultAgent: 'geotehnic',
    skipPatterns: [],
    agentRules: [
      { pattern: /studiu geotehnic|raport geotehnic|investigație|foraj|sondaj/i,   agent: 'geotehnic' },
      { pattern: /risc geotehnic|categorie geotehnică/i,                           agent: 'geotehnic' },
    ],
  },

  'Legea350-2001': {
    // defaultAgent: 'architectural' — POT/CUT/alinieri sunt reglementări de amplasament
    // (valorile numerice POT/CUT se calculează determinist în cod; RAG explică regulile)
    defaultAgent: 'architectural',
    skipPatterns: [],
    agentRules: [
      { pattern: /POT|CUT|ocupare.*teren|utilizare.*teren|procent.*ocupare/i,              agent: 'architectural' },
      { pattern: /aliniere|retragere|regim.*înălțime|zonă.*teren|front.*stradal/i,         agent: 'architectural' },
      { pattern: /PUG|PUZ|PUD|plan urbanistic|regulament.*urbanism|amenajare.*teritoriu/i, agent: 'legal' },
    ],
  },

  'P118-99': {
    // Normativ securitate la incendiu — relevant pentru Faza 2 (editor 2D: compartimentare)
    // și Faza 3 (deviz: materiale cu rezistență la foc)
    defaultAgent: 'architectural',
    skipPatterns: [],
    agentRules: [
      { pattern: /evacuare|timp.*evacuare|traseu.*evacuare|scară.*evacuare/i,              agent: 'architectural' },
      { pattern: /compartiment.*incendiu|rezistență la foc|\bREI\b|\bR\s*\d+/i,           agent: 'structural' },
      { pattern: /instalație.*stingere|sprinkler|detector.*fum|alarmă.*incendiu/i,         agent: 'structural' },
      { pattern: /risc.*incendiu|categorie.*pericol|densitate.*sarcinii termice/i,          agent: 'architectural' },
    ],
  },

  'NP051-2012': {
    // Normativ privind adaptarea clădirilor civile la nevoile persoanelor cu handicap
    defaultAgent: 'architectural',
    skipPatterns: [],
    agentRules: [
      { pattern: /rampă|pantă|lățime.*coridor|accesibilitate|handicap|dizabilită/i,       agent: 'architectural' },
      { pattern: /baie.*accesibil|grup.*sanitar|wc.*dizabilitat/i,                       agent: 'architectural' },
      { pattern: /dimensiuni.*uși|ușă.*accesibil|trecere.*liberă/i,                       agent: 'architectural' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────
// NORMATIVE_FILES — mapare source → filename în docsAI/
// Reflectă numele reale ale fișierelor din backend/docsAI/
// ─────────────────────────────────────────────────────────────────

export const NORMATIVE_FILES: Record<string, string> = {
  'P100-1-2013':   'cod-de-proiectare-seismic-indicativ-P100-1-2013.pdf',
  'NP112-2014':    'III_26_NP_112_2014.pdf',
  'CR6-2013':      '', // nu există în docsAI — se va skip automat
  'NE012-1-2022':  'Monitorul Oficial Partea I nr. 53Bis - Ordin + anexa__NE 012-1-2022.pdf',
  'CR1-1-4-2012':  'CR-1-1-4-2012.pdf',
  'Legea114-1996': 'Legea_locuintei.pdf', // Schimbat din .doc în .pdf (presupunând conversia utilizatorului) pentru a fi compatibil cu pdf-parse
  'Legea50-1991':  'Lege 50 1991(r2).pdf',
  'Legea10-1995':  'Lege 10 1995.pdf',
  'NP074-2022':    'NP_074-2022_.pdf',
  'Legea350-2001': 'Lege 350 2001.pdf',
  'P118-99':       'P118-99.pdf',
  'NP051-2012':    '17_23_NP_051_2012.pdf',
};

// ─────────────────────────────────────────────────────────────────
// AGENT_SOURCES — ce normative citește fiecare agent la query
// Folosit în ragService.ts pentru a filtra chunks din DB
// ─────────────────────────────────────────────────────────────────

// Sursele active (cu PDF indexat) pentru agentul 'general'
const ACTIVE_SOURCES = Object.entries(NORMATIVE_FILES)
  .filter(([, file]) => file !== '')
  .map(([source]) => source);

export const AGENT_SOURCES: Record<AgentType, string[]> = {
  geotehnic:     ['NP112-2014', 'NP074-2022', 'P100-1-2013'],
  seismic:       ['P100-1-2013'],
  structural:    ['CR6-2013', 'NE012-1-2022', 'P100-1-2013', 'CR1-1-4-2012', 'P118-99'],
  // Legea350-2001 → architectural (POT/CUT/alinieri = reglementări de amplasament)
  // P118-99, NP051-2012 → architectural (compartimentare, evacuare, handicap)
  architectural: ['CR1-1-4-2012', 'P100-1-2013', 'Legea350-2001', 'P118-99', 'NP051-2012'],
  // Legea350-2001 scoasă din legal — secțiunile de urbanism merg la architectural
  legal:         ['Legea114-1996', 'Legea50-1991', 'Legea10-1995'],
  general:       ACTIVE_SOURCES, // fallback fără filtru agent — caută în tot ce e indexat
  // Phase 3 — array gol = searchHybrid returnează [] imediat, fără query DB
  materiale:     [],
  deviz:         [],
};
