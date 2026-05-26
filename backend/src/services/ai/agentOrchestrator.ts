import { normativeCache } from './normativeCache';
import { AgentType, BuildingPurpose, AGENT_SOURCES_BY_PURPOSE } from '../../data/normative-registry';
import { searchHybrid } from './ragService';
import type { RoomSuggestion, SuggestRoomsInput } from '../../types/roomSuggestion';
import conformityRules from '../../data/conformity-rules.json';

import { getAi, FALLBACK_MODELS_CHAT, FALLBACK_MODELS_JSON, MAX_RETRIES_PER_MODEL } from './aiClient';
import { isOffTopic, detectRequiredAgents } from './agentRouter';
import { buildRAGContext, agentLabel, getStatusDisclaimer } from './promptBuilder';

export const agentOrchestrator = {
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
    if (isOffTopic(userQuestion)) {
      console.log(`[agentOrchestrator] Off-topic clar: "${userQuestion.slice(0, 60)}"`);
      async function* refusalStream() {
        yield { text: 'Această întrebare nu pare legată de construcția sau amenajarea casei tale. ' };
        yield { text: 'Sunt specializat pe tot ce ține de casa ta: plan, camere, materiale, normative, costuri, autorizații, instalații, finisaje.' };
        yield { text: '\n\nCe te interesează legat de proiectul tău?' };
      }
      return refusalStream();
    }

    const staticNormatives = await normativeCache.load();
    const screen = screenContext ?? 'screen1';
    const activeAgents = await detectRequiredAgents(userQuestion, screen);
    console.log(`[agentOrchestrator] Agenți detectați: [${activeAgents.join(', ')}]`);

    const ragContext = await buildRAGContext(
      userQuestion,
      screen,
      projectData ?? {}
    );

    const statusDisclaimer = getStatusDisclaimer(activeAgents);

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

    const label = agentLabel(activeAgents);
    const editorMentorBlock = screen === 'editor'
      ? `
CONTEXT SPECIAL — EDITOR 2D (companioniat activ):
- Explică DE CE camerele sunt recomandate așa (orientare, relații funcționale, normative NP057).
- Semnalează greșeli frecvente la compartimentare și cum se evită.
- Spune ce trebuie verificat înainte de a trece la Faza 3.
`
      : '';
    const prompt = `Ești Zidario, un asistent tehnic AI expert în proiectarea și construcția caselor din România.
Dacă utilizatorul cere ajutor, îl ghidezi ca mentor: explici DE CE înainte de CE, anticipezi următorii pași și pui o întrebare care avansează conversația.
Stilul tău este proactiv, educativ și empatic. Citezi normativele ca dovadă, nu ca jargon.
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

${editorMentorBlock}

${historyStr}ÎNTREBARE UTILIZATOR:
"${userQuestion}"

Răspunde profesional și clar. Explici DE CE înainte de CE.
Citează sursele exacte când menționezi normative (ex: Conform NP 112-2014, Art. 5.2).
La final: spune ce urmează după și pune o întrebare care avansează conversația.
Folosește limbaj simplu, paragrafe scurte. Markdown: doar bold și liste.`;

    let lastError: any = null;

    for (const modelName of FALLBACK_MODELS_CHAT) {
      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
        try {
          const responseStream = await getAi().models.generateContentStream({
            model: modelName,
            contents: prompt,
          });
          return responseStream;
        } catch (e: any) {
          lastError = e;
          const is503 = e?.status === 503 
            || e?.error?.code === 503 
            || String(e?.message ?? '').includes('503') 
            || String(e?.message ?? '').toLowerCase().includes('high demand');
          
          if (is503 && attempt < MAX_RETRIES_PER_MODEL) {
            const delay = attempt * 1500;
            console.warn(`[agentOrchestrator] 503 la stream cu ${modelName}, retry ${attempt}/${MAX_RETRIES_PER_MODEL} după ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }

          console.warn(`[agentOrchestrator] Eroare/Eșec cu ${modelName}, trecem la următorul model de fallback... Motiv: ${e?.message?.substring(0, 100)}...`);
          break; 
        }
      }
    }
    
    console.error(`[agentOrchestrator] Toate modelele au eșuat. Ultima eroare:`, lastError?.message);
    throw new Error('Serviciul de asistență tehnică este momentan indisponibil pe toate modelele. Te rugăm să revii mai târziu.');
  },
};

export async function suggestRoomProgram(input: SuggestRoomsInput): Promise<RoomSuggestion> {
  const targetArea = Math.min(Math.max(input.houseAreaSqm, 40), input.plotAreaSqm);
  
  const staticNormatives = await normativeCache.load();

  const purpose = (input.buildingPurpose as BuildingPurpose) ?? 'residential';
  
  const ragQuery = 'program functional plan compartimentare suprafata utila minima legala';
  const activeAgents = await detectRequiredAgents(ragQuery, 'editor');

  const contextParts = await Promise.all(
    activeAgents.map(async agent => {
      const agentSources = AGENT_SOURCES_BY_PURPOSE[purpose]?.[agent] || [];
      if (agentSources.length === 0) return null;

      const chunks = await searchHybrid(ragQuery, agent, 4, agentSources, purpose);
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

  const floorsDescription = [
    input.hasBasement ? 'subsol' : null,
    'parter',
    ...Array.from({ length: input.totalFloors - 1 }, (_, i) => `etaj${i + 1}`),
  ].filter(Boolean).join(' + ');

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
      "hasDoorTo": ["living", "bucatarie"], // OBLIGATORIU: Orice cameră trebuie să aibă ușă către minim altă cameră (de obicei hol)
      "naturalLight": true, // OBLIGATORIU true pentru camere de zi/dormitoare, false pentru debarale/holuri
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

  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS_JSON) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await getAi().models.generateContent({
          model: modelName,
          contents: prompt,
          config: { 
            temperature: 0.2, 
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

        const normalizeLabel = (label?: string) => (label ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\\s+/g, '').replace(/[^a-z0-9]/g, '');
        for (const room of parsed.rooms) {
          const rule = conformityRules.room_min_sqm.find((r: any) => 
            r.targets.includes(normalizeLabel(room.type))
          );
          if (rule && (room.minSqm === null || room.minSqm < rule.min_sqm)) {
            room.minSqm = rule.min_sqm; 
          }
        }

        console.log(`[suggestRoomProgram] OK (Model: ${modelName}) — ${parsed.rooms.length} camere, ${input.familySize} pers, stil ${input.houseStyle}.`);
        return parsed;

      } catch (e: any) {
        lastError = e;
        const is503 = e?.status === 503
          || e?.error?.code === 503
          || String(e?.message ?? '').includes('503')
          || String(e?.message ?? '').toLowerCase().includes('high demand');

        const isValidationError = String(e?.message ?? '').includes('Validare eșuată') || String(e?.message ?? '').includes('JSON invalid');

        if (is503 && attempt < MAX_RETRIES_PER_MODEL) {
          const delay = attempt * 1500;
          console.warn(`[suggestRoomProgram] 503 cu ${modelName}, retry ${attempt}/${MAX_RETRIES_PER_MODEL} după ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        
        if (isValidationError && attempt < MAX_RETRIES_PER_MODEL) {
          const delay = attempt * 1500;
          console.warn(`[suggestRoomProgram] Validare eșuată cu ${modelName}, retry ${attempt}/${MAX_RETRIES_PER_MODEL} după ${delay}ms... Eroare: ${e?.message}`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }

        console.warn(`[suggestRoomProgram] Eroare/Eșec cu ${modelName}, trecem la următorul model... Motiv: ${e?.message?.substring(0, 100)}...`);
        break;
      }
    }
  }

  console.error(`[suggestRoomProgram] Toate modelele au eșuat. Ultima eroare:`, lastError?.message);
  throw new Error('Serviciul de asistență este momentan indisponibil pe toate modelele. Te rugăm să încerci din nou.');
}
