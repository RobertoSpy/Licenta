import { apiPrivate, fetchWithAuth } from './axios';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChatPayload {
  message: string;
  history: ChatMessage[];
  screen: string;
  projectContext: Record<string, unknown>;
  historySummary?: string | null;
}

export interface SaveSummaryPayload {
  projectId: number;
  phase: string;
  screen: string | null;
  summary: string;
}

// ── Room Suggestion types (mirror backend types/roomSuggestion.ts) ─────────
export interface SuggestedRoom {
  type: string;
  label: string;
  weightRatio: number;
  zone: 'distributie' | 'zi' | 'noapte' | 'tehnic';
  floor: 'parter' | 'etaj1' | 'etaj2' | 'mansarda';
  reasoning: string;
  minSqm: number;
  maxSqm: number;
  mustAdjacentTo: string[];
  hasDoorTo: string[];
  isCirculation: boolean;
  hasStaircase: boolean;
  naturalLight: boolean;
  orientation: string[];
}

export interface RoomSuggestion {
  rooms: SuggestedRoom[];
  totalEstimatedSqm: number;
  layoutAdvice: string;
  normativeNote: string;
}

export type BudgetCategory = 'economic' | 'mediu' | 'premium';


export const aiApi = {
  /**
   * Streaming SSE chat cu Zidario.
   * onChunk — callback apelat pentru fiecare fragment de text primit.
   */
  async streamChat(
    payload: StreamChatPayload,
    onChunk: (text: string) => void
  ): Promise<void> {
    const response = await fetchWithAuth('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: payload.message,
        contextString: JSON.stringify(payload.projectContext),
        conversationHistory: payload.history.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          text: m.content,
        })),
        screenContext: payload.screen,
        historySummary: payload.historySummary ?? null,
      }),
    });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const raw = decoder.decode(value);
      const lines = raw.split('\n\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.replace('data: ', '').trim();
        if (dataStr === '[DONE]') return;

        try {
          const data = JSON.parse(dataStr);
          if (data.text) onChunk(data.text);
        } catch {
          // chunk SSE incomplet — ignorat
        }
      }
    }
  },

  /**
   * Rezumă o conversație — apel non-streaming.
   * Returnează string-ul rezumatului.
   */
  async summarize(conversationText: string): Promise<string> {
    const SUMMARY_SYSTEM_PROMPT = `
Rezumă conversația de mai jos în maxim 200 de cuvinte.
Păstrează obligatoriu: tipul solului ales, coordonatele/județul, configurația casei,
deciziile tehnice luate și întrebările fără răspuns clar.
Returnează DOAR rezumatul, fără introducere sau formulă de încheiere.
`.trim();

    const response = await apiPrivate.post('/ai/summarize', {
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      text: conversationText,
    });
    return response.data.summary as string;
  },

  /**
   * Citește rezumatul unui singur ecran din DB.
   * Returnează null dacă nu există.
   */
  async getSummary(
    projectId: number,
    phase: string,
    screen: string | null
  ): Promise<{ summary: string } | null> {
    const params: Record<string, string> = { phase };
    if (screen) params.screen = screen;

    const response = await apiPrivate.get(`/ai/summary/${projectId}`, {
      params,
    });
    return response.data.summary ? { summary: response.data.summary } : null;
  },

  /**
   * Citește rezumatele pentru un set de screen-uri (dependențele unui ecran).
   * Returnează array ordonat cronologic cu { screen, summary }.
   */
  async getSummaries(
    projectId: number,
    screens: string[]
  ): Promise<{ screen: string; summary: string }[]> {
    if (screens.length === 0) return [];

    // Facem GET-uri în paralel pentru fiecare screen dependent
    const results = await Promise.all(
      screens.map(async (screen) => {
        try {
          const response = await apiPrivate.get(
            `/ai/summary/${projectId}`,
            { params: { phase: phaseForScreen(screen), screen } }
          );
          const sum: string | null = response.data.summary;
          return sum ? { screen, summary: sum } : null;
        } catch {
          return null;
        }
      })
    );

    return results.filter(Boolean) as { screen: string; summary: string }[];
  },

  /**
   * Salvează (upsert) rezumatul unui ecran în DB.
   */
  async saveSummary(payload: SaveSummaryPayload): Promise<void> {
    await apiPrivate.post('/ai/summary', payload);
  },

  /**
   * SSE streaming — explică violările de conformitate (Legea 114/1996).
   * onChunk — callback apelat pentru fiecare fragment de text primit.
   * Unificat cu streamChat pentru consistență arhitecturală —
   * toate apelurile SSE trec prin aiApi, nu prin fetch raw.
   */
  async streamConformityExplanation(
    violations: Array<{ label: string; usableSqm: number; minRequired?: number }>,
    onChunk: (text: string) => void
  ): Promise<void> {
    const response = await fetchWithAuth('/api/editor/explain-conformity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ violations }),
    });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const raw = decoder.decode(value);
      const lines = raw.split('\n\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.replace('data: ', '').trim();
        if (dataStr === '[DONE]') return;

        try {
          const data = JSON.parse(dataStr);
          if (data.text) onChunk(data.text);
        } catch {
          // chunk SSE incomplet — ignorat
        }
      }
    }
  },

  /**
   * POST /api/ai/suggest-rooms
   * Solicită AI-ului să genereze programul funcțional recomandat (lista de camere).
   * Răspunsul conține rooms[] cu weightRatio gata de injectat în Slice-and-Dice.
   */
  async suggestRooms(
    projectId: number,
    familySize: number,
    budgetCategory: BudgetCategory,
    houseAreaSqm: number,
    totalFloors: number
  ): Promise<RoomSuggestion> {
    const response = await apiPrivate.post('/ai/suggest-rooms', {
      projectId,
      familySize,
      budgetCategory,
      houseAreaSqm,
      totalFloors,
    });
    return response.data as RoomSuggestion;
  },
};


// ── Utilitar local ────────────────────────────────────────────────────────────
function phaseForScreen(screen: string): string {
  const map: Record<string, string> = {
    screen1: 'faza1',
    screen2: 'faza1',
    screen3: 'faza1',
    screen4: 'faza1',
    editor: 'faza2',
    bom: 'faza3',
  };
  return map[screen] ?? 'faza1';
}
