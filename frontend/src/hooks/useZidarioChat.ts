import { useState, useCallback, useRef } from 'react';
import { getAccessToken } from '../api/axios';
import { apiPrivate } from '../api/axios';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Numărul maxim de mesaje înainte de a declanșa rezumarea automată */
const MAX_HISTORY = 10;

/**
 * Prompt-ul de sistem pentru rezumare.
 * Gemini va produce un rezumat compact care păstrează deciziile tehnice cheie.
 */
const SUMMARY_SYSTEM_PROMPT = `
Rezumă conversația de mai jos în maxim 200 de cuvinte.
Păstrează obligatoriu: tipul solului ales, coordonatele/județul, configurația casei,
deciziile tehnice luate și întrebările fără răspuns clar.
Returnează DOAR rezumatul, fără introducere sau formulă de încheiere.
`;

/**
 * useZidarioChat — Hook complet pentru chat-ul cu Zidario AI.
 *
 * Features:
 * - Streaming SSE (răspunsuri progresive)
 * - Rezumare automată la MAX_HISTORY mesaje (fără pierdere de context)
 * - Rezumate acumulative (rezumat la 10 → inclus în rezumatul la 20)
 * - Trimitere screenContext la backend pentru rutare SCREEN_AGENTS
 * - Guard de domeniu (refuz automat pe întrebări non-construcții)
 *
 * @param screen - Ecranul activ ('screen1' | 'screen2' | 'screen3' | 'screen4' | 'editor' | 'bom')
 * @param projectContext - Date despre proiectul curent trimise ca context la AI
 */
export function useZidarioChat(
  screen: string,
  projectContext: Record<string, unknown>
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  /**
   * summaryRef — Rezumatul acumulat al conversației.
   * Nu se stochează în state (nu cauzează re-render).
   * Format: string simplu, maxim 200 cuvinte per iterație, concatenate.
   */
  const summaryRef = useRef<string | null>(null);

  /**
   * Construiește istoricul trimis la backend.
   * Dacă există rezumat, îl injectează ca prim mesaj 'assistant'
   * pentru a oferi context AI-ului fără a trimite tot istoricul brut.
   */
  const buildHistory = useCallback((): ChatMessage[] => {
    const history: ChatMessage[] = [];
    if (summaryRef.current) {
      history.push({
        role: 'assistant',
        content: `[Rezumat conversație anterioară]: ${summaryRef.current}`
      });
    }
    return [...history, ...messages];
  }, [messages]);

  /**
   * Rezumă automat conversația când ajunge la MAX_HISTORY mesaje.
   * Returnează lista de mesaje redusă (păstrează ultimele 2 pentru context imediat).
   * Dacă rezumarea eșuează, taie la jumătate — mai bine decât eroare.
   */
  const summarizeIfNeeded = useCallback(async (
    currentMessages: ChatMessage[]
  ): Promise<ChatMessage[]> => {
    if (currentMessages.length < MAX_HISTORY) return currentMessages;

    const conversationText = currentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Zidario'}: ${m.content}`)
      .join('\n');

    try {
      const response = await apiPrivate.post('/ai/summarize', {
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        text: conversationText
      });
      const newSummary: string = response.data.summary;

      // Acumulăm rezumatele recursiv — nu pierdem niciodată context
      summaryRef.current = summaryRef.current
        ? `${summaryRef.current}\n\n${newSummary}`
        : newSummary;

      // Păstrăm doar ultimele 2 mesaje post-rezumare (context imediat)
      return currentMessages.slice(-2);
    } catch (err) {
      console.warn('[useZidarioChat] Rezumare eșuată, tăiem la -5:', err);
      return currentMessages.slice(-5);
    }
  }, []);

  /**
   * sendMessage — Trimite un mesaj utilizatorului și primește răspunsul în streaming.
   */
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: userText };

    // Adăugăm mesajul user și verificăm dacă trebuie rezumat
    let updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);

    updatedMessages = await summarizeIfNeeded(updatedMessages);
    setMessages(updatedMessages);

    // Placeholder gol pentru mesajul AI — se completează progresiv
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const token = getAccessToken();

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userText,
          contextString: JSON.stringify(projectContext),
          conversationHistory: buildHistory().map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            text: m.content
          })),
          screenContext: screen  // SCREEN_AGENTS routing
        })
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      // SSE Reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx]?.role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: updated[lastIdx].content + data.text
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // Ignorăm chunk-uri SSE incomplete
            }
          }
        }
      }
    } catch (e) {
      console.error('[useZidarioChat] Eroare SSE:', e);
      setMessages(prev => {
        const arr = [...prev];
        const lastIdx = arr.length - 1;
        if (arr[lastIdx]?.role === 'assistant') {
          arr[lastIdx] = {
            ...arr[lastIdx],
            content: '⚠️ O eroare a apărut la conectarea la asistent. Încearcă din nou.'
          };
        }
        return arr;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, screen, projectContext, buildHistory, summarizeIfNeeded]);

  /** Resetează complet chat-ul și rezumatul acumulat */
  const resetChat = useCallback(() => {
    setMessages([]);
    summaryRef.current = null;
  }, []);

  return { messages, isStreaming, sendMessage, resetChat };
}
