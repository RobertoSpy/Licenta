import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ConformityRoom, type ConformityRuleIssue } from '../../hooks/useConformityCheck';
import { aiApi } from '../../api/aiApi';
import { AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  violations: ConformityRoom[];
  violationIssues: ConformityRuleIssue[];
  warningIssues: ConformityRuleIssue[];
}

export const EditorConformityAlert: React.FC<Props> = ({
  violations,
  violationIssues,
  warningIssues,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const renderSources = (sources?: ConformityRuleIssue['sources']) => {
    if (!sources || sources.length === 0) return null;
    return (
      <div className="mt-2 space-y-1 text-[10px] text-slate-400">
        {sources.map((src, idx) => (
          <div key={`${src.source}-${idx}`}>
            <span className="font-semibold">{src.source}</span> · {src.chapter}
            {src.excerpt && (
              <div className="text-[10px] text-slate-400">{src.excerpt}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

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
      await aiApi.streamConformityExplanation(
        violations.map((v) => ({
          label: v.label,
          usableSqm: v.usableSqm,
          minRequired: v.minRequiredSqm,
        })),
        (text) => setAiExplanation((prev) => prev + text)
      );
    } catch (e) {
      console.error('[ConformityAlert] Eroare SSE:', e);
    } finally {
      setIsStreaming(false);
    }
  };

  if (violations.length === 0 && violationIssues.length === 0 && warningIssues.length === 0) return null;

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
                {violationIssues.length || violations.length} încălcări · {warningIssues.length} recomandări
              </span>
            </div>
            {isOpen ? <ChevronDown className="w-4 h-4 text-red-500" /> : <ChevronUp className="w-4 h-4 text-red-500" />}
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Lista violări */}
            <div className="space-y-2">
              {violationIssues.map((issue) => (
                <div key={`${issue.code}-${issue.targetId}`} className="flex items-start gap-3 bg-red-50 rounded-xl px-3 py-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <span className="font-bold text-slate-900">{issue.message}</span>
                    <div className="text-red-700">
                      {issue.currentValue} → {issue.requiredValue} ({issue.deltaValue} lipsă)
                    </div>
                    <div className="text-xs text-red-500 mt-1">{issue.suggestion}</div>
                    {renderSources(issue.sources)}
                  </div>
                </div>
              ))}
            </div>

            {warningIssues.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Recomandări</p>
                {warningIssues.map((issue) => (
                  <div key={`${issue.code}-${issue.targetId}`} className="flex items-start gap-3 bg-amber-50 rounded-xl px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm text-amber-800">
                      <div className="font-bold">{issue.message}</div>
                      <div>{issue.currentValue} → {issue.requiredValue} ({issue.deltaValue} lipsă)</div>
                      <div className="text-xs text-amber-600 mt-1">{issue.suggestion}</div>
                      {renderSources(issue.sources)}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
