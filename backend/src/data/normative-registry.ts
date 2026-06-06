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
  | 'energetic'  // Phase 3 placeholder — AGENT_SOURCES gol, nu face query DB
  | 'materiale'  // Phase 3 placeholder — AGENT_SOURCES gol, nu face query DB
  | 'instalatii' // I9-2022 (sanitare) si I7-2011 (electrice)
  | 'deviz'      // Phase 3 placeholder — AGENT_SOURCES gol, nu face query DB
  | 'financial'; // Market Intelligence — buletine INSSE + indici cost CNS107D

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

  'NP057-2002': {
    // Normativ privind proiectarea clădirilor de locuințe — program funcțional
    // Definește: zone funcționale (zi/noapte/distribuție), adiacențe obligatorii,
    // iluminare naturală minimă, circulație, relații spațiale între camere.
    // Folosit de suggestRoomProgram pentru validarea programului funcțional AI-generat.
    defaultAgent: 'architectural',
    skipPatterns: [],
    agentRules: [
      { pattern: /zonă.*zi|zonă.*noapte|zona de zi|zona de noapte|separare.*funcțional/i,  agent: 'architectural' },
      { pattern: /circulație|distribuție|hol|antreu|coridor|acces/i,                       agent: 'architectural' },
      { pattern: /iluminare naturală|ventilare naturală|orientare.*cameră/i,               agent: 'architectural' },
      { pattern: /suprafață.*cameră|suprafață minimă|aria utilă|mp minim/i,                agent: 'legal' },
      { pattern: /dormitor|living|bucătărie|baie|salon|sufragerie/i,                      agent: 'legal' },
    ],
  },

  'MC001-2022': {
    defaultAgent: 'energetic',
    skipPatterns: [],
    agentRules: [
      { pattern: /performanță.*energetică|calcul.*energetic|izolație|audit.*energetic|NZEB|consum/i, agent: 'energetic' },
    ],
  },

  'Legea372-2005': {
    defaultAgent: 'energetic',
    skipPatterns: [],
    agentRules: [
      { pattern: /certificat.*energetic|auditor|NZEB|performanță.*energetică/i, agent: 'energetic' },
    ],
  },

  'I9-2022': {
    defaultAgent: 'instalatii',
    skipPatterns: [],
    agentRules: [
      { pattern: /apă.*rece|apă.*caldă|conductă|țeavă|canalizare|scurgere|sanitar/i, agent: 'instalatii' },
    ],
  },

  'I7-2011': {
    defaultAgent: 'instalatii',
    skipPatterns: [],
    agentRules: [
      { pattern: /curent|electric|tensiune|cablu|priză|iluminat|tablou|împământare/i, agent: 'instalatii' },
    ],
  },

  // ─── Agent Financiar — Analiză piață construcții România ───
  // Sursele sunt buletine INSSE (txt) și PDF-uri cu indici cost CNS107D.
  // Indexate cu agent='financial' în NormativeChunk.
  'BULETIN-INSSE-2021': {
    defaultAgent: 'financial',
    skipPatterns: [],
    agentRules: [
      { pattern: /inflație|indice|cost|material|energie|piață|buget|prognoză/i, agent: 'financial' },
    ],
  },
  'BULETIN-INSSE-2022-IUN': {
    defaultAgent: 'financial',
    skipPatterns: [],
    agentRules: [
      { pattern: /inflație|indice|cost|material|energie|piață|buget|prognoză/i, agent: 'financial' },
    ],
  },
  'BULETIN-INSSE-2022-IUL': {
    defaultAgent: 'financial',
    skipPatterns: [],
    agentRules: [
      { pattern: /inflație|indice|cost|material|energie|piață|buget|prognoză/i, agent: 'financial' },
    ],
  },
  'BULETIN-INSSE-2026': {
    defaultAgent: 'financial',
    skipPatterns: [],
    agentRules: [
      { pattern: /inflație|indice|cost|material|energie|piață|buget|prognoză/i, agent: 'financial' },
    ],
  },
  'INDICII-COST': {
    defaultAgent: 'financial',
    skipPatterns: [],
    agentRules: [],
  },
  'ANEXE-4': {
    defaultAgent: 'financial',
    skipPatterns: [],
    agentRules: [],
  },
};

// ─────────────────────────────────────────────────────────────────
// NORMATIVE_FILES — mapare source → filename în docsAI/
// Reflectă numele reale ale fișierelor din backend/docsAI/
// ─────────────────────────────────────────────────────────────────

export const NORMATIVE_FILES: Record<string, string> = {
  'P100-1-2013':   'cod-de-proiectare-seismic-indicativ-P100-1-2013.pdf',
  'NP112-2014':    'III_26_NP_112_2014.md',
  'CR6-2013':      'V_9_3_CR_6_2013.pdf',
  'NE012-1-2022':  'Monitorul Oficial Partea I nr. 53Bis - Ordin + anexa__NE 012-1-2022.pdf',
  'CR1-1-4-2012':  'CR-1-1-4-2012.pdf',
  'Legea114-1996': 'Legea_locuintei (2).pdf',
  'Legea50-1991':  'Lege 50 1991(r2).pdf',
  'Legea10-1995':  'Lege 10 1995.pdf',
  'NP074-2022':    'NP_074-2022_.pdf',
  'Legea350-2001': 'Lege 350 2001.pdf',
  'P118-99':       'P118-99.pdf',
  'NP051-2012':    '17_23_NP_051_2012.pdf',
  'NP057-2002':    '17_18_NP_057_2002.md',
  'I9-2022':       '45 NORMATIV I9 - 2022.pdf',
  'I7-2011':       'Normativ-pentru-proiectarea-executia-si-exploatarea-instalatiilor-electrice-aferente-cladirilor-indicativ-I-7—2011.pdf',
  'MC001-2022':         'Mc-001-2022-Metodologie-calcul-performanta-energetica-cladiri.pdf',
  'Legea372-2005':      'legea-nr-372-2005-privind-performanta-energetica-a-cladirilor.pdf',
  // Agent Financial — buletine INSSE și indici cost
  'BULETIN-INSSE-2021':     'buletin_decembrie_2021.txt',
  'BULETIN-INSSE-2022-IUN': 'buletin_iunie_2022.txt',
  'BULETIN-INSSE-2022-IUL': 'buletin_iulie_2022.txt',
  'BULETIN-INSSE-2026':     'buletin_martie_2026.txt',
  'INDICII-COST':           'Indicii-cost-in-constructii.pdf',
  'ANEXE-4':                'ANEXE-4.pdf',
};

// ─────────────────────────────────────────────────────────────────
// AGENT_SOURCES — ce normative citește fiecare agent la query
// Folosit în ragService.ts pentru a filtra chunks din DB
// ─────────────────────────────────────────────────────────────────

// Sursele active (cu PDF indexat) pentru agentul 'general'
const ACTIVE_SOURCES = Object.entries(NORMATIVE_FILES)
  .filter(([, file]) => file !== '')
  .map(([source]) => source);

export type BuildingPurpose = 'residential' | 'commercial' | 'mixed';

// Normative PER TIP CLĂDIRE
export const AGENT_SOURCES_BY_PURPOSE: Record<BuildingPurpose, Record<AgentType, string[]>> = {
  residential: {
    architectural: ['CR1-1-4-2012', 'Legea350-2001', 'NP051-2012', 'NP057-2002', 'P118-99'],
    legal:         ['Legea114-1996', 'Legea50-1991', 'Legea10-1995', 'NP057-2002'],
    structural:    ['CR6-2013', 'NE012-1-2022', 'P100-1-2013', 'CR1-1-4-2012', 'P118-99'],
    seismic:       ['P100-1-2013'],
    geotehnic:     ['NP112-2014', 'NP074-2022', 'P100-1-2013'],
    general:       ACTIVE_SOURCES,
    energetic:     ['MC001-2022', 'Legea372-2005'],
    instalatii:    ['I9-2022', 'I7-2011'],
    materiale:     [],
    deviz:         [],
    financial:     ['BULETIN-INSSE-2021', 'BULETIN-INSSE-2022-IUN', 'BULETIN-INSSE-2022-IUL', 'BULETIN-INSSE-2026', 'INDICII-COST', 'ANEXE-4'],
  },
  commercial: {
    architectural: ['CR1-1-4-2012', 'P100-1-2013', 'Legea350-2001', 'P118-99', 'NP051-2012'],
    legal:         ['Legea50-1991', 'Legea10-1995'],
    structural:    ['CR6-2013', 'NE012-1-2022', 'P100-1-2013', 'CR1-1-4-2012', 'P118-99'],
    seismic:       ['P100-1-2013'],
    geotehnic:     ['NP112-2014', 'NP074-2022', 'P100-1-2013'],
    general:       ACTIVE_SOURCES,
    energetic:     ['MC001-2022', 'Legea372-2005'],
    instalatii:    ['I9-2022', 'I7-2011'],
    materiale:     [],
    deviz:         [],
    financial:     ['BULETIN-INSSE-2021', 'BULETIN-INSSE-2022-IUN', 'BULETIN-INSSE-2022-IUL', 'BULETIN-INSSE-2026', 'INDICII-COST', 'ANEXE-4'],
  },
  mixed: {
    architectural: ['CR1-1-4-2012', 'P100-1-2013', 'Legea350-2001', 'P118-99', 'NP051-2012', 'NP057-2002'],
    legal:         ['Legea114-1996', 'Legea50-1991', 'Legea10-1995', 'NP057-2002'],
    structural:    ['CR6-2013', 'NE012-1-2022', 'P100-1-2013', 'CR1-1-4-2012', 'P118-99'],
    seismic:       ['P100-1-2013'],
    geotehnic:     ['NP112-2014', 'NP074-2022', 'P100-1-2013'],
    general:       ACTIVE_SOURCES,
    energetic:     ['MC001-2022', 'Legea372-2005'],
    instalatii:    ['I9-2022', 'I7-2011'],
    materiale:     [],
    deviz:         [],
    financial:     ['BULETIN-INSSE-2021', 'BULETIN-INSSE-2022-IUN', 'BULETIN-INSSE-2022-IUL', 'BULETIN-INSSE-2026', 'INDICII-COST', 'ANEXE-4'],
  },
};
