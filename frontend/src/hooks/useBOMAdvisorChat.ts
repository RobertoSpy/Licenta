// frontend/src/hooks/useBOMAdvisorChat.ts
//
// Hook dedicat pentru chat-ul conversațional al Devizului (Faza 3).
// Respectă același pattern ca useZidarioChat.ts din Faza 1/2:
//   - Gestionează starea locală a conversației
//   - Apelează SSE stream de la POST /api/bom/:projectId/chat
//   - Suportă mesaj de bun venit inițial (autoGreet)

import { useState, useCallback, useRef, useEffect } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
}

type BomPhaseKey = 'fundatie' | 'structura' | 'zidarie' | 'acoperis' | 'instalatii' | 'finisaje';

export function useBOMAdvisorChat(projectId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePhase, setActivePhase] = useState<BomPhaseKey>('fundatie');
  const [completedPhases, setCompletedPhases] = useState<BomPhaseKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;

    const loadIntro = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/bom/${projectId}/intro`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) throw new Error('Intro failed');
        const data = await response.json();

        if (isMounted) {
          setMessages([{ role: 'assistant', text: data.text || 'Salut! Cu ce te pot ajuta?' }]);
        }
      } catch {
        if (isMounted) {
          setMessages([{ role: 'assistant', text: 'Salut! Cu ce te pot ajuta?' }]);
        }
      }
    };

    const loadPhaseState = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/bom/${projectId}/phase-state`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) return;
        const data = await response.json();
        if (data?.activePhase && isMounted) {
          setActivePhase(data.activePhase as BomPhaseKey);
        }
        if (Array.isArray(data?.completedPhases) && isMounted) {
          setCompletedPhases(data.completedPhases as BomPhaseKey[]);
        }
      } catch {
        // silent
      }
    };

    loadIntro();
    loadPhaseState();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    // Adaugă mesajul utilizatorului
    const userMsg: ChatMessage = { role: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Placeholder pentru răspunsul în streaming
    setMessages(prev => [...prev, { role: 'assistant', text: '', isStreaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/bom/${projectId}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            message: userText,
            // Trimitem ultimele 10 mesaje ca istoric (fără cel curent și cel placeholder)
            conversationHistory: messages.slice(-10).map(m => ({
              role: m.role,
              text: m.text,
            })),
          }),
        }
      );

      if (!response.body) throw new Error('No stream body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]') {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.isStreaming) {
                updated[updated.length - 1] = { ...last, isStreaming: false };
              }
              return updated;
            });
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.phase) {
              setActivePhase(parsed.phase as BomPhaseKey);
              if (Array.isArray(parsed.completedPhases)) {
                setCompletedPhases(parsed.completedPhases as BomPhaseKey[]);
              }
            }
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) {
                  updated[updated.length - 1] = { ...last, text: accumulated };
                }
                return updated;
              });
            }
          } catch { /* chunk parțial — ignorăm */ }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.isStreaming) {
          updated[updated.length - 1] = {
            role: 'assistant',
            text: 'Eroare la conectarea cu Zidario AI. Încearcă din nou.',
            isStreaming: false,
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [projectId, messages, isLoading]);

  const clearHistory = useCallback(() => {
    setMessages([{
      role: 'assistant',
      text: 'Conversația a fost resetată. Cu ce te pot ajuta?',
    }]);
  }, []);

  const confirmPhase = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/bom/${projectId}/phase-state/confirm`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) return;
      const data = await response.json();
      if (data?.activePhase) setActivePhase(data.activePhase as BomPhaseKey);
      if (Array.isArray(data?.completedPhases)) {
        setCompletedPhases(data.completedPhases as BomPhaseKey[]);
      }
    } catch {
      // silent
    }
  }, [projectId]);

  return { messages, isLoading, sendMessage, clearHistory, activePhase, completedPhases, confirmPhase };
}
