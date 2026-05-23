import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useZidarioChat } from '../../hooks/useZidarioChat';
import { useEditorState } from '../../hooks/useEditorState';
import { useRoomCalculator } from '../../hooks/useRoomCalculator';
import { Brain, X, Send } from 'lucide-react';

interface Props {
  projectId: number;
  projectData: Record<string, unknown>; // Datele din Faza 1
  isOpen: boolean;
  onToggle: () => void;
}

export const EditorChatSidebar: React.FC<Props> = ({ projectId, projectData, isOpen, onToggle }) => {
  const { elements } = useEditorState();
  const rooms = useRoomCalculator(elements);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Construim contextul injectabil la fiecare modificare a planului
  const projectContext = {
    phase1: projectData,
    editor2D: {
      totalRooms: rooms.length,
      roomsList: rooms.map(r => `${r.label}: ${r.usableSqm.toFixed(1)} mp`),
      totalAreaSqm: rooms.reduce((acc, r) => acc + r.usableSqm, 0).toFixed(1),
      canvasElementsCount: elements.length
    }
  };

  const { messages, isStreaming, sendMessage } = useZidarioChat('editor', projectId, projectContext);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0 || isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderContent = (content: string) => {
    const html = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
    return { __html: html };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl relative z-30"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Brain className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-none">Copilot Zidario</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Contextual AI</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 relative">
            {messages.length === 0 && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm bg-white border border-slate-200 text-slate-700 rounded-bl-sm space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <Brain className="w-4 h-4 text-amber-500" />
                    <span>Salutare! Sunt Copilotul tău Zidario. 🏠</span>
                  </div>
                  <p>Iată ce poți face în acest **Editor de Plan 2D (Mod Configurator)**:</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-600">
                    <li><strong>Schimbă forma casei</strong> (Dreptunghi, L, U, T) din panoul din stânga.</li>
                    <li><strong>Redimensionează lățimea și lungimea</strong> introducând valori exacte în metri.</li>
                    <li><strong>Bifează/debifează camere</strong> (ex. adaugă sau elimină WC, dormitoare, debarale).</li>
                    <li><strong>Rearanjează pozițiile camerelor</strong> trăgând (drag-and-drop) o cameră peste alta pentru a le schimba poziția.</li>
                    <li><strong>Ajustează dimensiunea unei camere</strong> apăsând pe ea și alegând o pondere de mărime (de la "Foarte Mică" la "Foarte Mare").</li>
                    <li><strong>Adaugă/șterge uși și ferestre</strong> manual selectându-le pe ecran sau folosind butoanele din proprietăți.</li>
                  </ul>
                  <p className="text-xs text-slate-500 border-t border-slate-100 pt-2 font-medium">
                    Pune-mi orice întrebare tehnică sau de design, iar eu îți voi răspunde pe baza reglementărilor din Legea 114/1996!
                  </p>
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              // Ascundem rezumatele tehnice de sistem dacă apar
              if (m.role === 'assistant' && m.content.includes('[Context proiect din conversații anterioare]')) return null;

              return (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'bg-buildorange text-white rounded-br-sm font-medium'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                  }`}>
                    {m.role === 'assistant' && m.content === '' && isStreaming ? (
                      <div className="flex gap-1.5 items-center h-4 px-2">
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
                      <p dangerouslySetInnerHTML={renderContent(m.content)} />
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Întreabă AI-ul despre desen..."
                className="flex-1 bg-slate-100 border border-transparent rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-buildorange focus:ring-4 focus:ring-orange-50 transition-all"
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                className="bg-slate-900 hover:bg-buildorange text-white rounded-xl p-2.5 flex items-center justify-center transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">Zidario AI citește JSON-ul planului tău în timp real.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
