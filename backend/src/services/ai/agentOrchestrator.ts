import { GoogleGenAI } from '@google/genai';
import { normativeCache } from './normativeCache';
import { AgentType, AGENT_SOURCES_BY_PURPOSE, BuildingPurpose } from '../../data/normative-registry';
import { searchHybrid, ragService } from './ragService';
import { embeddingService } from './embeddingService';
import { bomService } from '../bomService';
import type { RoomSuggestion, SuggestRoomsInput } from '../../types/roomSuggestion';

// ============================================================
// SEMANTIC ROUTING DESCRIPTIONS
// Folosite pentru clasificarea intenției când regex-ul eșuează
// ============================================================
const AGENT_DESCRIPTIONS: Partial<Record<AgentType, string>> = {
  geotehnic: "Informații despre sol, fundații, pământ, infiltrații, tasare, studiu geotehnic, foraje și adâncimea de îngheț.",
  seismic: "Cutremure, siguranță seismică, zonare, rezistență la cutremur, spectru de răspuns și parametri seismici.",
  structural: "Structura de rezistență, materiale de construcție, beton, armătură, fier, zidărie, stâlpi, grinzi, planșee și acoperiș.",
  architectural: "Design, arhitectură, planul casei, spații, compartimentare, scări, uși, ferestre, fațadă, iluminat, ventilare și funcționalitate.",
  legal: "Legislație, autorizații de construire, certificat de urbanism, primărie, vecini, retrageri, limite de proprietate, suprafețe minime legale și avize.",
  deviz: "Costuri, prețuri, buget, estimare financiară, cheltuieli, oferte și achiziții de materiale."
};

let cachedAgentEmbeddings: Record<string, number[]> | null = null;

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Funcție pentru inițializare lazy a clientului
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
};

// ============================================================
// DOMAIN GUARD — Clasificator de intenție pentru domeniu
// Abordare: BLACKLIST (refuz doar ce e clar off-topic)
// în loc de WHITELIST (acceptă doar ce conține cuvinte cheie).
//
// Rațiune: Un proprietar care construiește o casă va întreba
// lucruri ca "unde să fie pusa baia", "câte prize să pun",
// "cum aranjez living-ul" — întrebări perfect legitime despre
// casa lui, dar care nu conțin niciun cuvânt dintr-o listă
// de termeni tehnici de construcții.
// ============================================================
const OFF_TOPIC_PATTERNS = [
  // Rețete și mâncare
  /reteta|rețetă|gatit|gătit|mancare|mâncare|restaurant|pizza|prajitura|prăjitură/i,
  // Știri, politică
  /politica|politică|alegeri|partid|premier|presedinte|președinte|guvern|stire|știre/i,
  // Sport (excepție: construcția unui teren de sport rămâne validă)
  /fotbal|baschet|tenis|handbal|olimpiada|olimpiadă|meci|echipa de fotbal/i,
  // Entertainment, celebrități
  /film|serial|muzica|muzică|actor|cantaret|cântăreț|concert|celebrity|influencer/i,
  // Medicină generală (nu legată de locuință)
  /diagnostic|medicament|boala|boală|spital|tratament|simptome/i,
  // Finanțe generale (nu legate de construcție)
  /criptomoneda|criptomonedă|actiuni|acțiuni|bursa|bursă|forex|trading/i,
];

/**
 * Returnează true dacă mesajul este CLAR off-topic (total nerelated cu casa/construcția).
 * Returnează false (= lasă să treacă) pentru orice alt mesaj —
 * inclusiv întrebări generale despre casă, design, electricitate, instalații.
 */
function isOffTopic(message: string): boolean {
  return OFF_TOPIC_PATTERNS.some(pattern => pattern.test(message));
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
// DETECT REQUIRED AGENTS — routing hibrid (Regex + Semantic)
// Ordinea: Regex rapid -> Embedding Semantic fallback -> Screen fallback
// ============================================================
export async function detectRequiredAgents(
  question: string,
  screen: string
): Promise<AgentType[]> {
  const q = question.toLowerCase();
  const agents = new Set<AgentType>();

  // --- 1. CLASIFICARE BAZATĂ PE REGEX (Fast Path) ---

  // GEOTEHNIC — sol, fundație, îngheț, adâncime, apă freatică, foraje, pământ, tasare
  if (/sol|teren|fundati|fundare|inghet|îngheț|adancime|adâncime|argilos|nisipos|pietros|stancos|stâncos|apa freatica|apă freatică|infiltrar|geotehni|capacitate portant|tasar|foraj|studiu geotehnic|pamant|pământ|alunecare|umiditate/i.test(q)) {
    agents.add('geotehnic');
  }

  // SEISMIC — cutremur, zonă seismică, etaje, parametri seismici, grad, rezistență
  if (/seismic|cutremur|etaj|inaltime cladire|înălțime clădire|zona|ag\b|tc\b|accelerati|spectru seismic|risc seismic|richter|zguduial/i.test(q)) {
    agents.add('seismic');
  }

  // STRUCTURAL — materiale structurale, armare, zidărie, ancoraj, fier, placă, acoperiș
  if (/zidarie|zidărie|beton|armar|perete structural|zia\b|zna\b|zc\b|dch\b|dcm\b|grosime|rezistent|cleme|fixare|ancor|sutiune|suțiune|smulgere|stalp|stâlp|grinda|grindă|planseu|planșeu|fier|etrier|placa|placă|turnare|ciment|caramida|cărămidă|bca|sarpanta|șarpantă|caprior/i.test(q)) {
    agents.add('structural');
  }

  // ARCHITECTURAL — formă plan, compartimentare, fațadă, iluminat, uși, ferestre
  if (/plan|regularitate|simetrie|categorie.*teren|rugozitate|expunere|vant|vânt|tip.*acoperis|acoperiș|forma|formă|design|aspect|compartimentare|scara|scară|hol|fereastra|fereastră|usa|ușă|iluminat|ventilare|fatada|fațadă/i.test(q)) {
    agents.add('architectural');
  }

  // LEGAL — suprafețe minime, autorizații, primărie, vecini, limite, urbanism
  if (/suprafata|suprafață|metru patrat|metru pătrat|\bmp\b|camera|cameră|living|dormitor|baie|bucatarie|bucătărie|minim legal|legea|autorizati|pug\b|puz\b|pud\b|urbanism|aviz|certificat|primarie|primărie|norme|reguli|retragere|limita proprietate|vecin|calcan|gard|aprobare/i.test(q)) {
    agents.add('legal');
  }

  // DEVIZ/MATERIALE — costuri, prețuri, estimare, achiziții
  if (/cost|pret|preț|deviz|buget|estimare|mc\b|metru cub|cheltuieli|achiziti|cumpar|magazin|materiale|oferta/i.test(q)) {
    agents.add('deviz');
    agents.add('materiale');
  }

  // --- 2. CLASIFICARE SEMANTICĂ CU EMBEDDING (Fallback inteligent) ---
  // Dacă regex-ul nu a găsit nicio potrivire (ex: "ce îmi trebuie pentru un plan decent?")
  if (agents.size === 0) {
    try {
      // Lazy init pentru embeddings ale profilurilor agenților
      if (!cachedAgentEmbeddings) {
        cachedAgentEmbeddings = {};
        for (const [agent, desc] of Object.entries(AGENT_DESCRIPTIONS)) {
          cachedAgentEmbeddings[agent] = await embeddingService.embed(desc);
        }
      }

      const questionEmbedding = await embeddingService.embed(question);
      let foundSemantic = false;

      for (const [agent, vector] of Object.entries(cachedAgentEmbeddings)) {
        const similarity = cosineSimilarity(questionEmbedding, vector);
        // Prag empiric: 0.60
        if (similarity > 0.60) {
          console.log(`[detectRequiredAgents] Semantic Match -> Agent: ${agent} (Scor: ${similarity.toFixed(2)}) pentru "${question}"`);
          agents.add(agent as AgentType);
          foundSemantic = true;
          
          if (agent === 'deviz') agents.add('materiale');
        }
      }
      
      // Dacă am găsit semantic, logăm
      if (foundSemantic) {
        console.log(`[detectRequiredAgents] Agenți din semantic: [${[...agents].join(', ')}]`);
      }
    } catch (e: any) {
      console.error('[detectRequiredAgents] Eroare la clasificarea semantică:', e.message);
    }
  }

  // FALLBACK 1: folosim screen-ul activ dacă keyword routing nu a prins nimic
  if (agents.size === 0 && screen && SCREEN_AGENTS[screen]) {
    SCREEN_AGENTS[screen].forEach(a => agents.add(a));
    console.log(`[detectRequiredAgents] Fallback pe screen "${screen}": [${[...agents].join(', ')}]`);
  }

  // FALLBACK 2: legal ca default absolut (cel mai sigur pentru discuții generale despre casă)
  if (agents.size === 0) {
    agents.add('legal');
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
    buildingPurpose?: string | null;
  }
): Promise<string> {
  const agents = await detectRequiredAgents(question, screen);
  const limitPerAgent = agents.length === 1 ? 5 : 3;

  console.log(`[buildRAGContext] Agenți activi: [${agents.join(', ')}] pentru screen="${screen}"`);

  // Interogăm toți agenții în paralel
  const contextParts = await Promise.all(
    agents.map(async agent => {
      const purpose = (project.buildingPurpose as BuildingPurpose) ?? 'residential';
      const agentSources = AGENT_SOURCES_BY_PURPOSE[purpose][agent];

      // materiale și deviz nu au chunks în DB încă (Faza 3) — skip silențios
      if (agentSources.length === 0) return null;

      const chunks = await searchHybrid(question, agent, limitPerAgent, agentSources);
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
      buildingPurpose?: string | null;
    }
  ) {
    // 0. DOMAIN GUARD — refuzăm doar ce e clar off-topic
    if (isOffTopic(userQuestion)) {
      console.log(`[agentOrchestrator] Off-topic clar: "${userQuestion.slice(0, 60)}"`);
      async function* refusalStream() {
        yield { text: 'Această întrebare nu pare legată de construcția sau amenajarea casei tale. ' };
        yield { text: 'Sunt specializat pe tot ce ține de casa ta: plan, camere, materiale, normative, costuri, autorizații, instalații, finisaje.' };
        yield { text: '\n\nCe te interesează legat de proiectul tău?' };
      }
      return refusalStream();
    }

    // 1. CAG — date statice mereu disponibile
    const staticNormatives = await normativeCache.load();

    // 2. Detectăm agenții necesari (Regex + Semantic routing + Screen fallback)
    const screen = screenContext ?? 'screen1';
    const activeAgents = await detectRequiredAgents(userQuestion, screen);
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

// ============================================================
// SUGGEST ROOM PROGRAM — Funcție separată, non-streaming
// Gemini raționează pe baza:
//   1. Regulilor hardcodate în prompt (număr dormitoare per persoane, hol obligatoriu etc.)
//   2. RAG din NP057-2002 + Legea114-1996 (zone funcționale, suprafețe minime)
//   3. Profilului din Faza 1 (stil, buget, suprafață teren, etaje)
// Returnează un JSON {rooms[], totalEstimatedSqm, layoutAdvice, normativeNote}
// care se injectează direct în Slice-and-Dice prin setActiveRooms().
// ============================================================
export async function suggestRoomProgram(input: SuggestRoomsInput): Promise<RoomSuggestion> {
  // 1. Suprafața disponibilă per nivel — folosim suprafața casei introdusă de user
  const targetArea = Math.min(Math.max(input.houseAreaSqm, 40), input.plotAreaSqm);
  const areaPerFloor = Math.round(targetArea / input.totalFloors);

  // 2. CAG — normative statice (conțin suprafețele minime din Legea 114/1996)
  const staticNormatives = await normativeCache.load();

  // 3. RAG — hybrid search din sursele specifice destinației
  const purpose = (input.buildingPurpose as BuildingPurpose) ?? 'residential';
  
  const ragQuery = 'program functional plan compartimentare suprafata utila minima legala';
  const activeAgents = await detectRequiredAgents(ragQuery, 'editor');

  const contextParts = await Promise.all(
    activeAgents.map(async agent => {
      const agentSources = AGENT_SOURCES_BY_PURPOSE[purpose][agent];
      if (!agentSources || agentSources.length === 0) return null;

      const chunks = await searchHybrid(ragQuery, agent, 4, agentSources);
      if (chunks.length === 0) return null;

      const chunksText = chunks
        .map(c => `[${c.source} — ${c.chapter}]\n${c.content}`)
        .join('\n\n');

      return `[AGENT ${agent.toUpperCase()}]\n${chunksText}`;
    })
  );

  const ragContext = contextParts.filter(Boolean).length > 0
    ? contextParts.filter(Boolean).join('\n\n---\n\n')
    : 'Normative generale — zone funcționale și suprafețe minime.';

  // 4. Dormitoare și băi minime
  const minBedrooms = Math.max(1, Math.ceil(input.familySize / 2));
  const minBathrooms = Math.max(1, Math.ceil(minBedrooms / 3));

  // 5. Descriere structură etaje pentru prompt
  const floorsDescription = [
    input.hasBasement ? 'subsol' : null,
    'parter',
    ...Array.from({ length: input.totalFloors - 1 }, (_, i) => `etaj${i + 1}`),
  ].filter(Boolean).join(' + ');

  // 6. Prompt orientat spre output JSON pur
  const prompt = `Ești Zidario, expert în proiectare rezidențială română.
Recomandă programul funcțional optim pentru o locuință.
Răspunde EXCLUSIV în JSON valid, fără text suplimentar.

DATE PROIECT:
- Suprafață construită totală: ${targetArea} mp (OBLIGATORIU respectat)
- Suma suprafețelor camerelor: între ${Math.round(targetArea * 0.80)}–${Math.round(targetArea * 0.92)} mp
- Structura: ${floorsDescription}
- Număr persoane: ${input.familySize}
- Stil arhitectural: ${input.houseStyle}
- Categorie buget: ${input.budgetCategory}
- Orientare față de stradă: ${input.streetOrientation}

NORMATIVE ÎN VIGOARE (consultă și respectă obligatoriu):
${ragContext}

NORMATIVE STATICE (valori numerice exacte):
${staticNormatives}

RĂSPUNDE DOAR CU JSON. ESTE STRICT OBLIGATORIU SĂ INCLUZI TOATE CÂMPURILE PENTRU FIECARE CAMERĂ (dacă nu ai o valoare, folosește null sau []):
{
  "rooms": [
    {
      "type": "hol",
      "label": "Hol Intrare",
      "weightRatio": 1.0,
      "zone": "distributie",
      "floor": "parter",
      "isCirculation": true,
      "hasStaircase": false,
      "minSqm": null,
      "maxSqm": null,
      "mustAdjacentTo": [],
      "hasDoorTo": [],
      "naturalLight": false,
      "orientation": [],
      "reasoning": "citat exact din normativul găsit"
    }
  ],
  "totalEstimatedSqm": 900,
  "layoutAdvice": "...",
  "normativeNote": "..."
}

Tipuri valide 'type': hol, living, bucatarie, dormitor, baie, wc, camara, birou, sala_mese, terasa, debara
Zone valide: distributie, zi, noapte, tehnic
Floor valide: parter, etaj1, etaj2, mansarda
weightRatio: 0.5 (mic) → 4.0 (mare)`;

  // 7. Apel Gemini — non-streaming, JSON complet, cu retry la 503
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { 
          temperature: 0.2, // predictibil, nu creativ
          responseMimeType: 'application/json'
        }, 
      });

      const raw = response.text ?? '';
      const parsed = JSON.parse(raw) as RoomSuggestion;

      if (!parsed.rooms || !Array.isArray(parsed.rooms) || parsed.rooms.length === 0) {
        throw new Error('JSON invalid: câmpul "rooms" lipsește sau e gol.');
      }

      if (parsed.totalEstimatedSqm < targetArea * 0.75) {
        throw new Error(`Validare eșuată: AI a generat doar ${parsed.totalEstimatedSqm}mp din ${targetArea}mp ceruți.`);
      }

      console.log(`[suggestRoomProgram] OK — ${parsed.rooms.length} camere, ${input.familySize} pers, stil ${input.houseStyle}.`);
      return parsed;

    } catch (e: any) {
      const is503 = e?.status === 503
        || e?.error?.code === 503
        || String(e?.message ?? '').includes('503')
        || String(e?.message ?? '').toLowerCase().includes('high demand');

      const isValidationError = String(e?.message ?? '').includes('Validare eșuată') || String(e?.message ?? '').includes('JSON invalid');

      if ((is503 || isValidationError) && attempt < MAX_RETRIES) {
        const delay = attempt * 1500; // 1.5s, 3s
        console.warn(`[suggestRoomProgram] Retry ${attempt}/${MAX_RETRIES} după ${delay}ms... Eroare: ${e?.message}`);
        await new Promise(res => setTimeout(res, delay));
        continue;
      }

      console.error('[suggestRoomProgram] Eroare:', e.message);
      throw new Error('Nu s-a putut genera sugestia de camere. Încearcă din nou.');
    }
  }

  // Fallback typescript satisfaction (nu se atinge niciodată)
  throw new Error('Nu s-a putut genera sugestia de camere. Încearcă din nou.');
}
