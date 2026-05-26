import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '../../api/axios';

// Icons simple svg
const BrainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface AIChatBubbleProps {
  contextData?: Record<string, unknown>; // Date pe care le oferim AI-ului ca referință (ex: date teren)
  welcomeMessage?: string; // Mesaj predefinit afișat la deschidere, fără apel backend
  suggestedAction?: {
    label: string;
    onApply: () => void;
  };
  defaultOpen?: boolean;
}

export const AIChatBubble: React.FC<AIChatBubbleProps> = ({ contextData, welcomeMessage, suggestedAction, defaultOpen }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen || false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const welcomeInjected = useRef(false);

  // Injectează mesajul de bun venit la prima montare (fără apel backend)
  useEffect(() => {
    if (welcomeMessage && !welcomeInjected.current) {
      welcomeInjected.current = true;
      setMessages([{ role: 'ai', content: welcomeMessage }]);
    }
  }, [welcomeMessage]);

  // Auto scroll la ultimul mesaj DOAR dacă utilizatorul a întrebat ceva sau AI-ul scrie activ
  useEffect(() => {
    if (messages.length > 1 || isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessageText = input.trim();
    setInput("");

    // Adăugăm mesajul user-ului și un placeholder gol pentru AI
    setMessages(prev => [...prev, { role: 'user', content: userMessageText }, { role: 'ai', content: "" }]);
    setIsStreaming(true);

    try {
      // Construim istoricul conversației pentru backend (ultimele 10 mesaje pentru context)
      // Excludem ultimul mesaj AI (încă gol) din history
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.content,
      }));

      const response = await fetchWithAuth('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessageText,
          contextString: contextData ? JSON.stringify(contextData) : "Fără context de teren.",
          conversationHistory,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      // SSE Reader logic — citim stream-ul bucată cu bucată
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
            if (dataStr === '[DONE]') {
              setIsStreaming(false);
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  if (newMessages[lastIdx]?.role === 'ai') {
                    newMessages[lastIdx] = {
                      ...newMessages[lastIdx],
                      content: newMessages[lastIdx].content + data.text
                    };
                  }
                  return newMessages;
                });
              }
            } catch {
              // Ignorăm erorile de parse din chunk-uri incomplete
            }
          }
        }
      }
    } catch (e) {
      console.error('[AIChatBubble] Eroare SSE:', e);
      setMessages(prev => {
        const arr = [...prev];
        const lastIdx = arr.length - 1;
        if (arr[lastIdx]?.role === 'ai') {
          arr[lastIdx] = { ...arr[lastIdx], content: "⚠️ O eroare a apărut la conectarea la asistent. Încearcă din nou." };
        }
        return arr;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Renderează markdown simplu (bold + newline)
  const renderContent = (content: string) => {
    const html = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
    return { __html: html };
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="mb-4 bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 md:w-96 flex flex-col overflow-hidden"
            style={{ height: '480px' }}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-10 shrink-0">
              <div className="flex items-center gap-2">
                <BrainIcon />
                <div>
                  <h3 className="font-semibold text-sm leading-none">Zidario AI</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Expert tehnic în construcții</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 hover:text-amber-400 transition-colors"
                aria-label="Închide asistentul"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.length === 0 && !welcomeMessage && (
                <div className="text-center text-gray-400 text-sm mt-10 px-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BrainIcon />
                  </div>
                  <p className="font-medium text-slate-600 mb-1">Salut! Sunt Zidario.</p>
                  <p className="text-xs">Adresează-mi o întrebare tehnică despre terenul, normativele sau construcția ta!</p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white rounded-br-sm'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {m.role === 'ai' && m.content === '' && isStreaming ? (
                      // Indicator de typing
                      <div className="flex gap-1 items-center h-4">
                        {[0, 1, 2].map(dot => (
                          <motion.div
                            key={dot}
                            className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: dot * 0.15 }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p
                        className="whitespace-pre-wrap leading-relaxed"
                        dangerouslySetInnerHTML={renderContent(m.content)}
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Action Button dacă AI sugerează ceva */}
              {!isStreaming && messages.length > 0 && suggestedAction && (
                <div className="flex justify-start">
                  <button
                    onClick={suggestedAction.onApply}
                    className="ml-2 mt-1 bg-amber-400/20 text-amber-900 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-amber-400/40 transition-colors border border-amber-400/50"
                  >
                    🚀 {suggestedAction.label}
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Întreabă despre normative, teren..."
                className="flex-1 bg-slate-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                disabled={isStreaming}
                aria-label="Mesaj pentru asistentul AI"
              />
              <button
                onClick={sendMessage}
                disabled={isStreaming || !input.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Trimite mesaj"
              >
                <SendIcon />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="bg-slate-900 text-white p-4 rounded-full shadow-2xl hover:shadow-amber-500/20 hover:bg-slate-800 transition-all border border-slate-700/50 group"
          aria-label="Deschide asistentul AI Zidario"
        >
          <div className="flex items-center gap-2">
            <BrainIcon />
            <span className="font-semibold text-sm hidden md:block px-1 group-hover:text-amber-400 transition-colors">
              Ai întrebări tehnice?
            </span>
          </div>
        </motion.button>
      )}
    </div>
  );
};
