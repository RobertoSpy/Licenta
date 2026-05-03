import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {api} from '../../api/axios';

// Icons simple svg
const BrainIcon = () => (
  <svg xmlns="http://www. কণ্ঠেw3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

interface AIChatBubbleProps {
  contextData: any; // Date pe care le oferim AI-ului ca referință (ex: date teren)
  suggestedAction?: {
    label: string;
    onApply: () => void;
  };
}

export const AIChatBubble: React.FC<AIChatBubbleProps> = ({ contextData, suggestedAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }, { role: 'ai', content: "" }]);
    setIsStreaming(true);

    try {
      // Preluăm token-ul pentru autentificare din localstorage sau unde l-am stocat
      const token = localStorage.getItem('token'); 

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: userMessage,
          contextString: JSON.stringify(contextData)
        })
      });

      if (!response.body) throw new Error("No response body");

      // SSE Reader logic
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
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIdx = newMessages.length - 1;
                if (newMessages[lastIdx].role === 'ai') {
                  newMessages[lastIdx].content += data.text;
                }
                return newMessages;
              });
            } catch (e) {
               // Ignoram json error de la splituri gresite partiale din retea
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => {
        const arr = [...prev];
        arr[arr.length-1].content = "O eroare a apărut la conectarea la asistent.";
        return arr;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 md:w-96 flex flex-col overflow-hidden"
            style={{ height: '450px' }}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-10">
              <div className="flex items-center gap-2">
                <BrainIcon />
                <h3 className="font-semibold text-sm">Zidario Technical Expert</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:text-amber-400 transition-colors">
                <CloseIcon />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-10">
                  <p>Adresează-mi o întrebare tehnică despre terenul sau normativele tale!</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    m.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-br-none' 
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                  }`}>
                    {/* Render Basic Markdown (for bold text using regex or simple format) */}
                    <p className="whitespace-pre-wrap leading-relaxed" 
                       dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} 
                    />
                  </div>
                </div>
              ))}
              
              {/* Action Button if Ai suggests something */}
              {!isStreaming && messages.length > 0 && suggestedAction && (
                <div className="flex justify-start">
                   <button 
                     onClick={suggestedAction.onApply}
                     className="ml-2 mt-2 bg-amber-400/20 text-amber-900 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-amber-400/40 transition-colors border border-amber-400/50"
                   >
                     🚀 {suggestedAction.label}
                   </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Întreabă normativul..."
                className="flex-1 bg-slate-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={isStreaming}
              />
              <button 
                onClick={sendMessage}
                disabled={isStreaming || !input.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
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
        >
          <div className="flex items-center gap-2">
            <BrainIcon />
            <span className="font-semibold text-sm hidden md:block px-1 group-hover:text-amber-400 transition-colors">Ai întrebări tehnice?</span>
          </div>
        </motion.button>
      )}
    </div>
  );
};
