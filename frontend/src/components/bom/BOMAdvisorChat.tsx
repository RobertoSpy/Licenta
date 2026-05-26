// frontend/src/components/bom/BOMAdvisorChat.tsx
//
// Panoul conversațional Zidario AI integrat pe pagina Devizului (Faza 3).
// Respectă același design ca EditorChatSidebar.tsx — aceeași experiență UX.
//
// Poate fi afișat ca:
//   1. Sidebar fix (isInline=false) — glisează din dreapta, suprapus
//   2. Panou inline (isInline=true) — afișat direct sub header, în pagina BOM

import { useState, useRef, useEffect } from 'react';
import { useBOMAdvisorChat } from '../../hooks/useBOMAdvisorChat';
import { ConstructionStepTracker } from './ConstructionStepTracker';
import { X, Send, Bot, RotateCcw } from 'lucide-react';

// Renderer minimal pentru Markdown — fără librărie externă
// Suportă: **bold**, bullet lists (-), paragrafe
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-0.5 my-2 text-slate-700">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      listItems.push(line.slice(2));
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<div key={key++} className="h-2" />);
      } else {
        elements.push(
          <p key={key++} className="text-slate-800 leading-relaxed" dangerouslySetInnerHTML={{
            __html: line
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
          }} />
        );
      }
    }
  }
  flushList();
  return elements;
}


interface BOMAdvisorChatProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const BOMAdvisorChat = ({ projectId, isOpen, onClose }: BOMAdvisorChatProps) => {
  const { messages, isLoading, sendMessage, clearHistory, activePhase, completedPhases, confirmPhase } = useBOMAdvisorChat(projectId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Sugestii rapide — întrebări frecvente contextuale
  const quickQuestions = [
    'Ce tip de fundație îmi recomandați pentru solul meu?',
    'Ce clasă de beton este necesară?',
    'Ce tip de zidărie e potrivit pentru zona mea?',
    'Explicați cerințele seismice pentru structura mea.',
    'Ce materiale de acoperiș recomandați?',
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panou lateral */}
      <div className="fixed top-0 right-0 h-full w-[460px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-buildorange/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-buildorange" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Zidario AI — Advisor Deviz</h2>
              <p className="text-[10px] text-slate-400">RAG: CR6-2013 · NP112-2014 · NE012-1-2022 · P100-1-2013</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearHistory}
              title="Resetează conversația"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70">
          <ConstructionStepTracker
            activePhase={activePhase}
            completedPhases={completedPhases}
          />
          {!completedPhases.includes(activePhase) && (
            <div className="px-5 pb-2">
              <button
                onClick={confirmPhase}
                className="text-[11px] px-3 py-1.5 rounded-full border border-buildorange text-buildorange hover:bg-orange-50 transition-all"
              >
                Confirma etapa
              </button>
            </div>
          )}
        </div>

        {/* Mesaje */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-buildorange" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-buildorange text-white rounded-tr-sm'
                    : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="space-y-1 text-sm">
                    {renderMarkdown(msg.text || (msg.isStreaming ? '...' : ''))}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 ml-0.5 bg-buildorange animate-pulse rounded-sm" />
                    )}
                  </div>
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            </div>
          ))}

          {/* Sugestii rapide — afișate doar la început */}
          {messages.length === 1 && (
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Întrebări frecvente</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-buildorange hover:text-buildorange hover:bg-orange-50 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={2}
              disabled={isLoading}
              placeholder="Întreabă despre fundație, materiale, norme tehnice..."
              className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-buildorange focus:ring-1 focus:ring-buildorange/20 disabled:opacity-60 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Răspunsurile citează normativele tehnice din baza de date
          </p>
        </div>
      </div>
    </>
  );
};
