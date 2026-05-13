import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomInfo } from '../../hooks/useRoomCalculator';
import { getAccessToken } from '../../api/axios';
import { AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  violations: RoomInfo[];
}

export const EditorConformityAlert: React.FC<Props> = ({ violations }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (violations.length === 0) {
      setAiExplanation('');
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    fetchAiExplanation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [violations.map((v) => v.id + v.usableSqm).join(',')]);

  const fetchAiExplanation = async () => {
    setAiExplanation('');
    setIsStreaming(true);

    try {
      const token = getAccessToken();
      const response = await fetch('/api/editor/explain-conformity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          violations: violations.map((v) => ({
            label: v.label,
            usableSqm: v.usableSqm,
            minRequired: v.minRequiredSqm,
          })),
        }),
      });

      if (!response.body) return;
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
            if (dataStr === '[DONE]') { setIsStreaming(false); break; }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) setAiExplanation((prev) => prev + parsed.text);
            } catch { /* ignorăm chunk-uri incomplete */ }
          }
        }
      }
    } catch (e) {
      console.error('[ConformityAlert] Eroare SSE:', e);
    } finally {
      setIsStreaming(false);
    }
  };

  if (violations.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white border border-red-200 rounded-2xl shadow-2xl overflow-hidden z-30"
        >
          {/* Header */}
          <div
            className="bg-red-50 px-5 py-3 flex items-center justify-between cursor-pointer"
            onClick={() => setIsOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-bold text-red-800">
                {violations.length} {violations.length === 1 ? 'cameră' : 'camere'} sub limita legală (Legea 114/1996)
              </span>
            </div>
            {isOpen ? <ChevronDown className="w-4 h-4 text-red-500" /> : <ChevronUp className="w-4 h-4 text-red-500" />}
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Lista violări */}
            <div className="space-y-2">
              {violations.map((v) => (
                <div key={v.id} className="flex items-center gap-3 bg-red-50 rounded-xl px-3 py-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <div className="flex-1 text-sm">
                    <span className="font-bold text-slate-900">{v.label}</span>
                    <span className="text-red-700">
                      {' '}— {v.usableSqm} m² util (minim legal: {v.minRequiredSqm} m²)
                    </span>
                    <span className="text-xs text-red-500 ml-1">
                      ← {((v.minRequiredSqm ?? 0) - v.usableSqm).toFixed(1)} m² lipsă
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* AI explicație SSE */}
            {(aiExplanation || isStreaming) && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  🤖 Zidario explică
                  {isStreaming && <span className="inline-block w-1.5 h-4 bg-buildorange animate-pulse rounded-sm" />}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {aiExplanation}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
