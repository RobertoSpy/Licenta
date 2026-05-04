import { GoogleGenAI } from '@google/genai';
import { normativeCache } from './normativeCache';
import { ragAgentGeotehnic } from './ragAgentGeotehnic';
import { ragAgentSeismic } from './ragAgentSeismic';
import { ragAgentLegal } from './ragAgentLegal';
import { ragService } from './ragService'; // fallback general

// Funcție pentru inițializare lazy a clientului
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

/**
 * Detectează agentul potrivit pe baza keyword-urilor din întrebare.
 * Rutare simplă bazată pe intenție — fără apel AI suplimentar.
 */
function detectAgent(question: string): 'geotehnic' | 'seismic' | 'legal' | 'general' {
  const q = question.toLowerCase();

  if (/sol|fundati|teren|argilos|nisipos|pietros|stancos|geotehnic|capacitate portanta|tasare|infiltrat|umiditate/.test(q)) {
    return 'geotehnic';
  }
  if (/seismic|cutremur|zona|accelerati|ag\b|spectru|risc seismic|structura|cadre/.test(q)) {
    return 'seismic';
  }
  if (/autorizati|lege|pug|puz|pot\b|cut\b|urbanism|aviz|regulament|permis|constructie legala|retrocedar/.test(q)) {
    return 'legal';
  }

  return 'general';
}

export const agentOrchestrator = {
  /**
   * Orchestrează interogarea Multi-Agent RAG + CAG și returnează un stream SSE.
   * Fiecare întrebare este rutată la agentul specializat potrivit (geotehnic/seismic/legal).
   */
  async getAiStreamForChat(
    userQuestion: string,
    contextString: string,
    conversationHistory: { role: string; text: string }[] = []
  ) {
    // 1. Încărcăm CAG (date statice — mereu disponibil)
    const staticNormatives = await normativeCache.load();

    // 2. Detectăm intenția și rutăm la agentul corect
    const agent = detectAgent(userQuestion);
    console.log(`[agentOrchestrator] Intenție detectată: "${agent}" pentru: "${userQuestion.slice(0, 60)}..."`);

    let ragContext = '';
    if (agent === 'geotehnic') {
      ragContext = await ragAgentGeotehnic.search(userQuestion, 3);
    } else if (agent === 'seismic') {
      ragContext = await ragAgentSeismic.search(userQuestion, 3);
    } else if (agent === 'legal') {
      ragContext = await ragAgentLegal.search(userQuestion, 3);
    } else {
      // general: câte 1 chunk din fiecare agent pentru diversitate
      const [g, s, l] = await Promise.all([
        ragAgentGeotehnic.search(userQuestion, 1),
        ragAgentSeismic.search(userQuestion, 1),
        ragAgentLegal.search(userQuestion, 1),
      ]);
      ragContext = [g, s, l].filter(Boolean).join('\n\n') || await ragService.searchRelevantChunks(userQuestion, 3);
    }

    // 3. Istoricul conversației
    let historyStr = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyStr = 'ISTORIC CONVERSAȚIE:\n' +
        conversationHistory
          .slice(-10)
          .map(msg => `[${msg.role === 'user' ? 'Utilizator' : 'Zidario'}]: ${msg.text}`)
          .join('\n') + '\n\n';
    }

    // 4. Compunem promptul cu contextul izolat per agent
    const agentLabel = agent === 'geotehnic' ? 'Geotehnică & Fundații'
      : agent === 'seismic' ? 'Seismicitate & Structură'
      : agent === 'legal' ? 'Legislație & Urbanism'
      : 'General';

    const prompt = `Ești Zidario, un asistent tehnic AI expert în proiectarea și construcția caselor din România.
Rolul tău este să oferi suport tehnic direct, fără ocolviri, pe un ton prietenos dar extrem de precis.
Domeniul detectat pentru această întrebare: **${agentLabel}**

CONTEXT CURENT UTILIZATOR (informații preluate automat):
${contextString}

NORMATIVE STATICE (CAG — referință fixă):
${staticNormatives}

REGLEMENTĂRI RELEVANTE DIN NORMATIVE (RAG — ${agentLabel}):
${ragContext || 'Baza de cunoaștere RAG nu a fost indexată încă. Bazează-te pe CAG și cunoștințele generale.'}

${historyStr}ÎNTREBARE UTILIZATOR:
"${userQuestion}"

Răspunde profesionist, citează sursele exacte (ex: Conform NP 112-2014, Art. 5.2...) dacă este nevoie.
Folosește limbaj simplu de om normal, nu jargon tehnic inutil. Paragrafe scurte. Markdown: doar bold și liste.`;

    // 5. Returnăm stream-ul
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
