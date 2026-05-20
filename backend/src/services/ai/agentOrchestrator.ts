import { GoogleGenAI } from '@google/genai';
import { normativeCache } from './normativeCache';
import { AgentType, AGENT_SOURCES } from '../../data/normative-registry';
import { searchHybrid, ragService } from './ragService';
import { bomService } from '../bomService';

// Funcție pentru inițializare lazy a clientului
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

// ============================================================
// DOMAIN GUARD — Clasificator de intenție pentru domeniu
// Previne apeluri Gemini pentru întrebări total irelevante.
// ============================================================
const CONSTRUCTION_KEYWORDS = [
  'fundatie', 'fundație', 'beton', 'zidarie', 'zidărie', 'bca', 'caramida',
  'cărămidă', 'sol', 'teren', 'structura', 'structură', 'etaj', 'acoperis',
  'acoperiș', 'normativ', 'seismic', 'instalatie', 'instalație', 'deviz',
  'material', 'constructie', 'construcție', 'fundare', 'armatura', 'armătură',
  'izolatie', 'izolație', 'santier', 'șantier', 'autorizatie', 'autorizație',
  'casa', 'casă', 'perete', 'planseu', 'planșeu', 'stalp', 'stâlp', 'grinda',
  'grindă', 'lemn', 'acoperire', 'mansarda', 'mansardă', 'subsol', 'parter',
  'proiect', 'calcul', 'rezistenta', 'rezistență', 'sapatura', 'săpătură',
  'pamant', 'pământ', 'pietris', 'pietriș', 'argilos', 'nisipos', 'stâncos',
  'cutremur', 'seismicitate', 'zona', 'judet', 'județ',
];

/**
 * Verifică dacă mesajul are legătură cu domeniul construcțiilor.
 * Returnează false pentru întrebări complet off-topic (rețete, știri etc.)
 */
function isConstructionRelated(message: string): boolean {
  const lower = message.toLowerCase();
  return CONSTRUCTION_KEYWORDS.some(kw => lower.includes(kw));
}

// ============================================================
// SCREEN AGENTS MAP — fallback per ecran când keyword routing nu prinde
// ============================================================
export const SCREEN_AGENTS: Record<string, AgentType[]> = {
  screen1: ['geotehnic', 'seismic'],
  screen2: ['geotehnic'],
  screen3: ['seismic', 'structural', 'legal'],
  screen4: ['legal'],
  editor:  ['legal', 'structural'],
  bom:     ['structural', 'materiale', 'deviz'],
  timeline:['legal', 'structural'],
};

// ============================================================
// DETECT REQUIRED AGENTS — routing pe baza keyword-urilor
// Returnează array de agenți unici.
// Ordinea regulilor contează: mai specific înainte de mai general.
// ============================================================
export function detectRequiredAgents(
  question: string,
  screen: string
): AgentType[] {
  const q = question.toLowerCase();
  const agents = new Set<AgentType>();

  // GEOTEHNIC — sol, fundație, îngheț, adâncime, apă freatică
  if (/sol|teren|fundati|fundare|inghet|îngheț|adancime|adâncime|argilos|nisipos|pietros|stancos|stâncos|apa freatica|apă freatică|infiltrar|geotehni|capacitate portant|tasar/.test(q)) {
    agents.add('geotehnic');
  }

  // SEISMIC — cutremur, zonă seismică, etaje, parametri seismici
  if (/seismic|cutremur|etaj|inaltime cladire|înălțime clădire|zona|ag\b|tc\b|accelerati|spectru seismic|risc seismic/.test(q)) {
    agents.add('seismic');
  }

  // STRUCTURAL — materiale structurale, armare, zidărie, ancoraj acoperiș
  if (/zidarie|zidărie|beton|armar|perete structural|zia\b|zna\b|zc\b|dch\b|dcm\b|grosime perete|rezistent|cleme|fixare|ancor|sutiune|suțiune|smulgere|stalp|stâlp|grinda|grindă|planseu|planșeu/.test(q)) {
    agents.add('structural');
  }

  // ARCHITECTURAL — formă plan, regularitate, categorie teren, expunere vânt
  if (/plan|regularitate|simetrie|categorie.*teren|rugozitate|expunere|vant|vânt|tip.*acoperis|acoperiș|forma.*casa|formă.*casă/.test(q)) {
    agents.add('architectural');
  }

  // LEGAL — suprafețe minime, Legea 114, autorizații, PUG
  if (/suprafata|suprafață|metru patrat|metru pătrat|\bmp\b|camera|cameră|living|dormitor|baie|bucatarie|bucătărie|minim legal|legea 114|autorizati|pug\b|puz\b|urbanism/.test(q)) {
    agents.add('legal');
  }

  // DEVIZ/MATERIALE — costuri, prețuri, estimare (Faza 3, încă active în SCREEN_AGENTS)
  if (/cost|pret|preț|deviz|buget|estimare|mc\b|metru cub|cheltuieli/.test(q)) {
    agents.add('deviz');
    agents.add('materiale');
  }

  // FALLBACK 1: folosim screen-ul activ dacă keyword routing nu a prins nimic
  if (agents.size === 0 && screen && SCREEN_AGENTS[screen]) {
    SCREEN_AGENTS[screen].forEach(a => agents.add(a));
    console.log(`[detectRequiredAgents] Fallback pe screen "${screen}": [${[...agents].join(', ')}]`);
  }

  // FALLBACK 2: seismic ca default absolut
  if (agents.size === 0) {
    agents.add('seismic');
  }

  return [...agents];
}

// ============================================================
// BUILD RAG CONTEXT — asamblează contextul RAG complet pentru prompt
// Apelează toți agenții detectați în paralel (Promise.all)
// ============================================================
export async function buildRAGContext(
  question: string,
  screen: string,
  project: {
    county?: string | null;
    locality?: string | null;
    seismicZone?: string | null;
    frostDepthCm?: number | null;
    soilType?: string | null;
    windPressureKpa?: number | null;
    terrainCategory?: string | null;
  }
): Promise<string> {
  const agents = detectRequiredAgents(question, screen);
  const limitPerAgent = agents.length === 1 ? 5 : 3;

  console.log(`[buildRAGContext] Agenți activi: [${agents.join(', ')}] pentru screen="${screen}"`);

  // Interogăm toți agenții în paralel
  const contextParts = await Promise.all(
    agents.map(async agent => {
      // materiale și deviz nu au chunks în DB încă (Faza 3) — skip silențios
      if (AGENT_SOURCES[agent].length === 0) return null;

      const chunks = await searchHybrid(question, agent, limitPerAgent);
      if (chunks.length === 0) return null;

      const chunksText = chunks
        .map(c => `§ ${c.source} — ${c.chapter}:\n${c.content}`)
        .join('\n\n');

      return `[AGENT ${agent.toUpperCase()}]\n${chunksText}`;
    })
  );

  // Date deterministe din proiect — injectate direct în prompt, nu din RAG
  // AI-ul NU recalculează aceste valori — le citește și le explică
  const foundationSpec = bomService.getFoundationSpec(project.frostDepthCm, project.soilType);

  const projectLines = [
    '[DATE PROIECT — DETERMINISTE]',
    project.county          ? `Județ: ${project.county}` : null,
    project.locality        ? `Localitate: ${project.locality}` : null,
    project.seismicZone     ? `Zonă seismică: ${project.seismicZone} (P100-1-2013, Anexa A)` : null,
    project.frostDepthCm    ? `Adâncime îngheț: ${project.frostDepthCm} cm (NP112-2014, Anexa B)` : null,
    project.soilType        ? `Tip sol: ${project.soilType}` : null,
    project.windPressureKpa ? `Presiune vânt qb: ${project.windPressureKpa} kPa (CR1-1-4-2012, Anexa A)` : null,
    project.terrainCategory ? `Categorie teren rugozitate: ${project.terrainCategory}` : null,
    // Clasa betonului — determinată de bomService, nu de AI
    project.frostDepthCm    ? bomService.formatForPrompt(foundationSpec) : null,
  ].filter(Boolean).join('\n');

  return [
    projectLines,
    ...contextParts.filter(Boolean),
  ].join('\n\n---\n\n');
}

// ============================================================
// AGENT LABEL — string lizibil pentru afișare în prompt
// ============================================================
function agentLabel(agents: AgentType[]): string {
  const labels: Record<AgentType, string> = {
    geotehnic:     'Geotehnică & Fundații',
    seismic:       'Seismicitate & Structură',
    structural:    'Structuri & Materiale',
    architectural: 'Arhitectură & Reglementări',
    legal:         'Legislație & Urbanism',
    materiale:     'Cataloage Materiale',
    deviz:         'Deviz & Estimare Costuri',
    general:       'General',
  };
  return agents.map(a => labels[a]).join(', ');
}

// ============================================================
// STATUS DISCLAIMER — pentru normative în revizuire
// ============================================================
function getStatusDisclaimer(agents: AgentType[]): string {
  if (agents.includes('seismic')) {
    return '\n⚠️ **Notă normativ:** P100-1/2013 este versiunea în vigoare. P100-1/2025 este în stadiu de redactare și nu a intrat în vigoare.\n';
  }
  return '';
}

// ============================================================
// MAIN ORCHESTRATOR
// ============================================================
export const agentOrchestrator = {
  /**
   * Orchestrează interogarea Multi-Agent RAG + CAG și returnează un stream SSE.
   *
   * @param userQuestion     - Întrebarea utilizatorului
   * @param contextString    - Date despre proiectul curent (județ, tip sol, etc.)
   * @param conversationHistory - Ultimele mesaje din chat
   * @param screenContext    - Contextul de ecran activ (ex: 'screen1', 'editor', 'bom')
   * @param historySummary   - Rezumat pre-încărcat din DB de frontend
   * @param projectData      - Date deterministe din proiect (seismicZone, frostDepth etc.)
   */
  async getAiStreamForChat(
    userQuestion: string,
    contextString: string,
    conversationHistory: { role: string; text: string }[] = [],
    screenContext?: string,
    historySummary?: string | null,
    projectData?: {
      county?: string | null;
      locality?: string | null;
      seismicZone?: string | null;
      frostDepthCm?: number | null;
      soilType?: string | null;
      windPressureKpa?: number | null;
      terrainCategory?: string | null;
    }
  ) {
    // 0. DOMAIN GUARD
    if (!isConstructionRelated(userQuestion)) {
      console.log(`[agentOrchestrator] Off-topic: "${userQuestion.slice(0, 60)}..."`);
      async function* refusalStream() {
        yield { text: 'Zidario este specializat exclusiv în construcții rezidențiale din România. ' };
        yield { text: 'Pentru această întrebare te rog să folosești un asistent general. ' };
        yield { text: '\n\nPot să te ajut cu: fundații, normative seismice, tipuri de sol, autorizații, estimări costuri sau orice altceva legat de construcția casei tale.' };
      }
      return refusalStream();
    }

    // 1. CAG — date statice mereu disponibile
    const staticNormatives = await normativeCache.load();

    // 2. Detectăm agenții necesari (keyword routing + screen fallback)
    const screen = screenContext ?? 'screen1';
    const activeAgents = detectRequiredAgents(userQuestion, screen);
    console.log(`[agentOrchestrator] Agenți detectați: [${activeAgents.join(', ')}]`);

    // 3. RAG — hybrid search pentru toți agenții în paralel
    const ragContext = await buildRAGContext(
      userQuestion,
      screen,
      projectData ?? {}
    );

    // 4. Disclaimer normative în revizuire
    const statusDisclaimer = getStatusDisclaimer(activeAgents);

    // 5. Istoricul conversației (ultimele 10 mesaje)
    let historyStr = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyStr =
        'ISTORIC CONVERSAȚIE:\n' +
        conversationHistory
          .slice(-10)
          .map(msg => `[${msg.role === 'user' ? 'Utilizator' : 'Zidario'}]: ${msg.text}`)
          .join('\n') +
        '\n\n';
    }

    // 6. Prompt final
    const label = agentLabel(activeAgents);
    const prompt = `Ești Zidario, un asistent tehnic AI expert în proiectarea și construcția caselor din România.
Rolul tău este să oferi suport tehnic direct, fără ocolviri, pe un ton prietenos dar extrem de precis.
Domenii active pentru această întrebare: **${label}**
${statusDisclaimer}
${
  historySummary
    ? `=== CONTEXT PROIECT (din conversații anterioare) ===\n${historySummary}\n`
    : ''
}
CONTEXT CURENT UTILIZATOR (informații preluate automat):
${contextString}

LIMITĂ TEHNICĂ CALCULATĂ DETERMINIST (nu o modifica, nu o recalcula):
- Citește "Maximum tehnic etaje", "Județ", "Localitate" din secțiunea CONTEXT CURENT UTILIZATOR.
- Această valoare vine din CR6-2013 + P100-1/2013, nu din AI.

OBLIGATORIU când discuți despre numărul de etaje permis:
1. Prezintă limita tehnică națională din context.
2. Avertizează că Primăria locală poate impune restricții mai stricte prin PUG.
3. Recomandă obținerea Certificatului de Urbanism de la Primărie — termen 30 zile, taxă 5-30 RON, temei Legea 50/1991.
4. Menționează că PUG-ul diferă de la primărie la primărie.
5. Subliniază că estimările ZIDARIO nu înlocuiesc documentația legală oficială.

NORMATIVE STATICE (CAG — referință fixă, date numerice exacte):
${staticNormatives}

REGLEMENTĂRI RELEVANTE DIN NORMATIVE (RAG — Hybrid Search: ${label}):
${ragContext}

${historyStr}ÎNTREBARE UTILIZATOR:
"${userQuestion}"

Răspunde profesionist, citează sursele exacte (ex: Conform NP 112-2014, Art. 5.2...) dacă este nevoie.
Folosește limbaj simplu de om normal, nu jargon tehnic inutil. Paragrafe scurte. Markdown: doar bold și liste.`;

    // 7. Stream Gemini
    try {
      const responseStream = await getAi().models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return responseStream;
    } catch (e: any) {
      console.error('[agentOrchestrator] Eroare Gemini:', e.message);
      throw new Error('Serviciul de asistență tehnică nu este disponibil.');
    }
  },
};
