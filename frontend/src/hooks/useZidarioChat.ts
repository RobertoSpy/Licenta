import { useState, useCallback, useRef, useEffect } from 'react';
import { aiApi } from '../api/aiApi';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isSystemInjection?: boolean;
  requiresAnswer?: boolean;
}

/** Numărul maxim de mesaje înainte de a declanșa rezumarea automată */
const MAX_HISTORY = 10;

// ── Dependențele între screen-uri ─────────────────────────────────────────────
// Definesc ce context anterior este relevant pentru fiecare ecran.
// La mount, hook-ul va încărca rezumatele screen-urilor dependente din DB
// și le va injecta ca context AI pentru sesiunea curentă.
const SCREEN_DEPENDENCIES: Record<string, string[]> = {
  screen1: [],
  screen2: ['screen1'],
  screen3: ['screen1', 'screen2'],
  screen4: ['screen1', 'screen2', 'screen3'],
  editor:  ['screen1', 'screen2', 'screen3', 'screen4'],
  bom:     ['screen3', 'screen4', 'editor'],
};

const SCREEN_PHASE: Record<string, string> = {
  screen1: 'faza1',
  screen2: 'faza1',
  screen3: 'faza1',
  screen4: 'faza1',
  editor:  'faza2',
  bom:     'faza3',
};

/**
 * useZidarioChat — Hook complet pentru chat-ul cu Zidario AI.
 *
 * Features:
 * - Streaming SSE (răspunsuri progresive)
 * - Rezumare automată la MAX_HISTORY mesaje (fără pierdere de context)
 * - Persistență rezumate în DB (supraviețuiesc refresh-ului paginii)
 * - Context cross-screen: rezumatele ecranelor anterioare sunt injectate la mount
 * - Guard de domeniu (refuz automat pe întrebări non-construcții)
 *
 * @param screen       - Ecranul activ ('screen1' | 'screen2' | ... | 'editor' | 'bom')
 * @param projectId    - ID-ul proiectului curent (obligatoriu pentru persistență)
 * @param projectContext - Date despre proiect trimise ca context la AI
 */
export function useZidarioChat(
  screen: string,
  projectId: number,
  projectContext: Record<string, unknown>
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * summaryRef — Rezumatul acumulat al conversației (din DB + sesiune curentă).
   * Nu e în state ca să nu cauzeze re-render inutil.
   */
  const summaryRef = useRef<string | null>(null);

  const addSystemMessage = useCallback((content: string, requiresAnswer = true) => {
    setMessages(prev => {
      // Don't add if the exact same message is already the last one (prevents strict mode double injection)
      if (prev.some(m => m.content === content)) {
        return prev;
      }
      return [...prev, { role: 'assistant', content, isSystemInjection: true, requiresAnswer }];
    });
    setUnreadCount(prev => prev + 1);
  }, []);

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);
  const phase = SCREEN_PHASE[screen] ?? 'faza1';

  // ── Încărcare context la mount ─────────────────────────────────────────────
  // La fiecare schimbare de ecran sau proiect:
  //   1. Citim rezumatul ecranului curent (dacă userul s-a mai întors)
  //   2. Citim rezumatele ecranelor dependente (context din pași anteriori)
  useEffect(() => {
    if (!projectId) return;

    summaryRef.current = null; // resetăm la schimbare de ecran

    const loadSummaries = async () => {
      const deps = SCREEN_DEPENDENCIES[screen] ?? [];

      // Apeluri paralele: rezumatul curent + rezumatele dependente
      const [currentResult, depResults] = await Promise.all([
        aiApi.getSummary(projectId, phase, screen),
        aiApi.getSummaries(projectId, deps),
      ]);

      const dependencyContext = depResults
        .map((s) => `[${s.screen}]: ${s.summary}`)
        .join('\n');

      const parts = [dependencyContext, currentResult?.summary].filter(Boolean);
      summaryRef.current = parts.length > 0 ? parts.join('\n\n') : null;
    };

    loadSummaries().catch((err) =>
      console.warn('[useZidarioChat] Eroare la încărcarea rezumatelor:', err)
    );
  }, [projectId, screen, phase]);

  // ── Restaurare și salvare mesaje din sessionStorage ────────────────────────
  useEffect(() => {
    if (!projectId || !screen) return;
    const cacheKey = `zidario_chat_${projectId}_${screen}`;
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.warn('Failed to parse cached chat messages', e);
      }
    }
  }, [projectId, screen]);

  useEffect(() => {
    if (!projectId || !screen) return;
    const cacheKey = `zidario_chat_${projectId}_${screen}`;
    if (messages.length > 0) {
      sessionStorage.setItem(cacheKey, JSON.stringify(messages));
    }
  }, [messages, projectId, screen]);

  // ── Constructorul de istoric ──────────────────────────────────────────────
  const buildHistory = useCallback((): ChatMessage[] => {
    const history: ChatMessage[] = [];
    if (summaryRef.current) {
      history.push({
        role: 'assistant',
        content: `[Context proiect din conversații anterioare]: ${summaryRef.current}`,
      });
    }
    return [...history, ...messages];
  }, [messages]);

  // ── Rezumare automată + persistență ──────────────────────────────────────
  const summarizeIfNeeded = useCallback(
    async (currentMessages: ChatMessage[]): Promise<ChatMessage[]> => {
      if (currentMessages.length < MAX_HISTORY) return currentMessages;

      const conversationText = currentMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Zidario'}: ${m.content}`)
        .join('\n');

      try {
        const newSummary = await aiApi.summarize(conversationText);

        // Acumulăm rezumatele recursiv — contextul nu se pierde niciodată
        const accumulated = summaryRef.current
          ? `${summaryRef.current}\n\n${newSummary}`
          : newSummary;

        // Salvăm în DB — rezumatul supraviețuiește refresh-ului
        await aiApi.saveSummary({
          projectId,
          phase,
          screen,
          summary: accumulated,
        });

        summaryRef.current = accumulated;

        // Păstrăm ultimele 2 mesaje pentru context imediat
        return currentMessages.slice(-2);
      } catch (err) {
        console.warn('[useZidarioChat] Rezumare eșuată, tăiem la -5:', err);
        return currentMessages.slice(-5);
      }
    },
    [projectId, phase, screen]
  );

  // ── sendMessage ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isStreaming) return;

      const userMessage: ChatMessage = { role: 'user', content: userText };
      let updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsStreaming(true);

      // Rezumăm dacă am atins limita
      updatedMessages = await summarizeIfNeeded(updatedMessages);
      setMessages(updatedMessages);

      // Placeholder gol pentru răspunsul AI — se completează progresiv
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      try {
        await aiApi.streamChat(
          {
            message: userText,
            history: buildHistory(),
            screen,
            projectContext,
            historySummary: summaryRef.current,
          },
          (chunk: string) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.role === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: updated[lastIdx].content + chunk,
                };
              }
              return updated;
            });
          }
        );
      } catch (e) {
        console.error('[useZidarioChat] Eroare SSE:', e);
        setMessages((prev) => {
          const arr = [...prev];
          const lastIdx = arr.length - 1;
          if (arr[lastIdx]?.role === 'assistant') {
            arr[lastIdx] = {
              ...arr[lastIdx],
              content:
                '⚠️ O eroare a apărut la conectarea la asistent. Încearcă din nou.',
            };
          }
          return arr;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, screen, projectContext, buildHistory, summarizeIfNeeded]
  );

  // ── resetChat ─────────────────────────────────────────────────────────────
  /** Resetează chat-ul local (nu șterge rezumatele din DB) */
  const resetChat = useCallback(() => {
    setMessages([]);
    summaryRef.current = null;
  }, []);

  // ── Listener pentru cereri globale (ex: MaterialSideDrawer) ────────────────
  useEffect(() => {
    const handleAskEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      if (customEvent.detail?.message) {
        sendMessage(customEvent.detail.message);
      }
    };
    window.addEventListener('zidario-ask', handleAskEvent);
    return () => window.removeEventListener('zidario-ask', handleAskEvent);
  }, [sendMessage]);

  return {
    messages,
    isStreaming,
    sendMessage,
    resetChat,
    addSystemMessage,
    unreadCount,
    markAsRead
  };
}
