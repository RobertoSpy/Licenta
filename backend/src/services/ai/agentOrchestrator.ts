import { GoogleGenAI } from '@google/genai';
import { normativeCache } from './normativeCache';
import { ragAgentGeotehnic } from './ragAgentGeotehnic';
import { ragAgentSeismic } from './ragAgentSeismic';
import { ragAgentLegal } from './ragAgentLegal';
import { ragAgentStructural } from './ragAgentStructural';
import { ragAgentMateriale } from './ragAgentMateriale';
import { ragAgentDeviz } from './ragAgentDeviz';
import { ragService } from './ragService'; // fallback general

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
  'cutremur', 'seismicitate', 'zona', 'judet', 'județ'
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
// SCREEN AGENTS MAP — care agenți sunt activi per ecran/context
// Această mapare definește sursa de cunoaștere pentru fiecare
// pas al aplicației. Adaugă screen-uri noi odată cu Faza 2/3.
// ============================================================
export const SCREEN_AGENTS: Record<string, string[]> = {
  // Faza 1 — Wizard
  screen1: ['geotehnic', 'seismic'],            // locație → sol + seismicitate
  screen2: ['geotehnic'],                        // tip sol, pantă, orientare
  screen3: ['seismic', 'structural', 'legal'],   // reglementări construcție
  screen4: ['legal'],                             // tip casă, suprafețe minime

  // Faza 2 — Editor 2D
  editor: ['legal', 'structural'],               // validare plan vs Legea 114 + CR6

  // Faza 3 — Deviz
  bom: ['structural', 'materiale', 'deviz'],     // cantități, materiale, prețuri
  timeline: ['legal', 'structural'],             // etape construcție, verificări
};

// Tipuri de agenți disponibili în sistem
type AgentType = 'geotehnic' | 'seismic' | 'legal' | 'structural' | 'materiale' | 'deviz' | 'general';

/**
 * Detectează agentul potrivit pe baza keyword-urilor din întrebare.
 * Rutare simplă bazată pe intenție — fără apel AI suplimentar.
 * Returnează un array de agenți relevanți (poate fi mai mult de unul).
 */
function detectAgents(question: string): AgentType[] {
  const q = question.toLowerCase();
  const agents: AgentType[] = [];

  // Geotehnic: sol, fundații, teren
  if (/sol|fundati|teren|argilos|nisipos|pietros|stancos|geotehnic|capacitate portanta|tasare|infiltrat|umiditate/.test(q)) {
    agents.push('geotehnic');
  }

  // Seismic: cutremure, accelerație, structură seismică
  if (/seismic|cutremur|zona|accelerati|ag\b|spectru|risc seismic/.test(q)) {
    agents.push('seismic');
  }

  // Structural: zidărie, beton, structura casei, zăpadă, vânt
  if (/zidarie|beton|stalp|grinda|planseu|structura|etaj|mansarda|incarcare|zapada|vant|cadre|armat/.test(q)) {
    agents.push('structural');
  }

  // Legal: autorizații, PUG, POT, CUT
  if (/autorizati|lege|pug|puz|pot\b|cut\b|urbanism|aviz|regulament|permis|constructie legala|retrocedar/.test(q)) {
    agents.push('legal');
  }

  // Deviz: costuri, prețuri, estimare
  if (/cost|pret|deviz|buget|estimare|mc|metru cub|cheltuieli|materiale/.test(q)) {
    agents.push('deviz');
    agents.push('materiale');
  }

  // Dacă nu s-a detectat nimic specific, returnăm 'general'
  return agents.length > 0 ? agents : ['general'];
}

/**
 * Execută căutarea RAG pentru un agent specificat și returnează contextul.
 */
async function fetchRagContext(agent: AgentType, question: string, limit: number = 3): Promise<string> {
  switch (agent) {
    case 'geotehnic':   return ragAgentGeotehnic.search(question, limit);
    case 'seismic':     return ragAgentSeismic.search(question, limit);
    case 'legal':       return ragAgentLegal.search(question, limit);
    case 'structural':  return ragAgentStructural.search(question, limit);
    case 'materiale':   return ragAgentMateriale.search(question, limit);
    case 'deviz':       return ragAgentDeviz.search(question, limit);
    case 'general':     return ragService.searchRelevantChunks(question, 3);
    default:            return '';
  }
}

/**
 * Generează un disclaimer automat pentru normativele în revizuire.
 * Apelat înainte de a compune prompt-ul final.
 */
function getStatusDisclaimer(agents: AgentType[]): string {
  if (agents.includes('seismic')) {
    return '\n⚠️ **Notă normativ:** P100-1/2013 este versiunea în vigoare. P100-1/2025 este în stadiu de redactare și nu a intrat în vigoare.\n';
  }
  return '';
}

export const agentOrchestrator = {
  /**
   * Orchestrează interogarea Multi-Agent RAG + CAG și returnează un stream SSE.
   * Fiecare întrebare este rutată la unul sau mai mulți agenți specializați.
   *
   * @param userQuestion - Întrebarea utilizatorului
   * @param contextString - Date despre proiectul curent (județ, tip sol, etc.)
   * @param conversationHistory - Ultimele mesaje din chat
   * @param screenContext - Contextul de ecran activ (ex: 'screen1', 'editor', 'bom')
   */
  async getAiStreamForChat(
    userQuestion: string,
    contextString: string,
    conversationHistory: { role: string; text: string }[] = [],
    screenContext?: string
  ) {
    // 0. DOMAIN GUARD — verificăm dacă întrebarea e legată de construcții
    //    Dacă nu, returnăm un "fake stream" cu mesaj de refuz (zero cost Gemini)
    if (!isConstructionRelated(userQuestion)) {
      console.log(`[agentOrchestrator] Off-topic detectat: "${userQuestion.slice(0, 60)}...". Refuz fără apel Gemini.`);
      async function* refusalStream() {
        yield { text: 'Zidario este specializat exclusiv în construcții rezidențiale din România. ' };
        yield { text: 'Pentru această întrebare te rog să folosești un asistent general. ' };
        yield { text: '\n\nPot să te ajut cu: fundații, normative seismice, tipuri de sol, autorizații, estimări costuri sau orice altceva legat de construcția casei tale.' };
      }
      return refusalStream();
    }

    // 1. CAG — date statice mereu disponibile
    const staticNormatives = await normativeCache.load();

    // 2. Detectăm agenții relevanți din întrebare
    //    Dacă avem un screen context activ, îl prioritizăm pentru agenți
    let activeAgents: AgentType[];
    if (screenContext && SCREEN_AGENTS[screenContext]) {
      activeAgents = SCREEN_AGENTS[screenContext] as AgentType[];
      console.log(`[agentOrchestrator] Rutare după screen: "${screenContext}" → agenți: [${activeAgents.join(', ')}]`);
    } else {
      activeAgents = detectAgents(userQuestion);
      console.log(`[agentOrchestrator] Rutare după keyword: agenți detectați: [${activeAgents.join(', ')}] pentru: "${userQuestion.slice(0, 60)}..."`);
    }

    // 3. RAG — căutăm în paralel în toți agenții activi
    //    Dacă sunt mai mulți agenți, fiecare aduce max 2 chunks (nu 3) pentru a nu umfla prompt-ul
    const limitPerAgent = activeAgents.length === 1 ? 3 : 2;

    const ragResults = await Promise.all(
      activeAgents.map(agent => fetchRagContext(agent, userQuestion, limitPerAgent))
    );
    const ragContext = ragResults.filter(Boolean).join('\n\n') || 'Baza de cunoaștere RAG nu a fost indexată încă.';

    // 4. Disclaimer pentru normative în revizuire
    const statusDisclaimer = getStatusDisclaimer(activeAgents);

    // 5. Istoricul conversației (ultimele 10 mesaje)
    let historyStr = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyStr = 'ISTORIC CONVERSAȚIE:\n' +
        conversationHistory
          .slice(-10)
          .map(msg => `[${msg.role === 'user' ? 'Utilizator' : 'Zidario'}]: ${msg.text}`)
          .join('\n') + '\n\n';
    }

    // 6. Label lizibil pentru domeniu
    const agentLabel = activeAgents
      .map(a => ({
        geotehnic: 'Geotehnică & Fundații',
        seismic: 'Seismicitate & Structură',
        legal: 'Legislație & Urbanism',
        structural: 'Structuri & Materiale',
        materiale: 'Cataloage Materiale',
        deviz: 'Deviz & Estimare Costuri',
        general: 'General',
      }[a]))
      .join(', ');

    // 7. Compunem prompt-ul final
    const prompt = `Ești Zidario, un asistent tehnic AI expert în proiectarea și construcția caselor din România.
Rolul tău este să oferi suport tehnic direct, fără ocolviri, pe un ton prietenos dar extrem de precis.
Domenii active pentru această întrebare: **${agentLabel}**
${statusDisclaimer}
CONTEXT CURENT UTILIZATOR (informații preluate automat):
${contextString}

NORMATIVE STATICE (CAG — referință fixă, date numerice exacte):
${staticNormatives}

REGLEMENTĂRI RELEVANTE DIN NORMATIVE (RAG — ${agentLabel}):
${ragContext}

${historyStr}ÎNTREBARE UTILIZATOR:
"${userQuestion}"

Răspunde profesionist, citează sursele exacte (ex: Conform NP 112-2014, Art. 5.2...) dacă este nevoie.
Folosește limbaj simplu de om normal, nu jargon tehnic inutil. Paragrafe scurte. Markdown: doar bold și liste.`;

    // 8. Stream
    try {
      const responseStream = await getAi().models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      return responseStream;
    } catch (e: any) {
      console.error('[agentOrchestrator] Eroare Gemini:', e.message);
      throw new Error('Serviciul de asistență tehnică nu este disponibil.');
    }
  }
};
