import { normativeCache } from './normativeCache';
import { AgentType, BuildingPurpose, AGENT_SOURCES_BY_PURPOSE } from '../../../data/normative-registry';
import { searchHybrid } from './ragService';
import type { RoomSuggestion, SuggestRoomsInput } from '../../../core/types/roomSuggestion';

import { getAi, FALLBACK_MODELS_CHAT, FALLBACK_MODELS_JSON, MAX_RETRIES_PER_MODEL } from './aiClient';
import { isOffTopic, detectRequiredAgents } from './agentRouter';
import { buildRAGContext, agentLabel, getStatusDisclaimer } from './promptBuilder';
import { buildChatPrompt, buildOffTopicRefusalStream } from './chatPromptBuilder';
import { buildRoomProgramPrompt, validateRoomSuggestion } from './roomProgramPrompt';

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
      return buildOffTopicRefusalStream();
    }


    const screen = screenContext ?? 'screen1';
    const activeAgents = await detectRequiredAgents(userQuestion, screen);
    console.log(`[agentOrchestrator] Agenți detectați: [${activeAgents.join(', ')}]`);

    // Injectăm contextul de piață în mod automat când ecranul este 'market'
    let enrichedContextString = contextString;
    if (screen === 'market') {
      try {
        const { marketService } = await import('../../market/marketService');
        const summary = await marketService.getSummary();
        enrichedContextString = summary.contextString + '\n\n' + contextString;
      } catch (e: any) {
        console.warn('[agentOrchestrator] Nu am putut îmbogăți contextul market:', e.message);
      }
    }

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

    const prompt = buildChatPrompt({
      userQuestion,
      contextString: enrichedContextString,
      conversationHistory,
      screenContext: screen,
      historySummary,
      activeAgents,
      statusDisclaimer,

      ragContext,
    });

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
  


  const purpose = (input.buildingPurpose as BuildingPurpose) ?? 'residential';

  // Query-uri specifice per agent — semantic mai apropiat de chunks-urile indexate
  const AGENT_QUERIES: Partial<Record<AgentType, string>> = {
    legal:         'suprafata minima camera locuinta dormitor living bucatarie baie hol minim legal',
    architectural: 'suprafata utila minima camera plan locuinta compartimentare zona zi noapte circulatie hol iluminare naturala NP057',
    structural:    'structura rezistenta pereti portanti beton armat grosime planseu',
    geotehnic:     'fundatie teren sol adancime fundare',
    seismic:       'zona seismica etaje inaltime cladire regim inaltime',
  };

  // Agents mereu activi pentru planul functional
  const activeAgents: AgentType[] = ['legal', 'architectural', 'structural', 'geotehnic', 'seismic'];

  const contextParts = await Promise.all(
    activeAgents.map(async agent => {
      const agentSources = AGENT_SOURCES_BY_PURPOSE[purpose]?.[agent] || [];
      if (agentSources.length === 0) return null;

      const query = AGENT_QUERIES[agent] ?? 'plan functional locuinta compartimentare';
      const chunks = await searchHybrid(query, agent, 4, agentSources, purpose);
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

  const prompt = buildRoomProgramPrompt({
    input,
    ragContext,

    targetArea,
  });

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
        const parsed = validateRoomSuggestion(JSON.parse(raw) as RoomSuggestion, targetArea);

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
