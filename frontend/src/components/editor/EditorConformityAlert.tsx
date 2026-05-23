import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ConformityRoom, type ConformityRuleIssue } from '../../hooks/useConformityCheck';
import { aiApi } from '../../api/aiApi';
import { AlertTriangle, XCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(true);
  const [aiExplanation, setAiExplanation] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const totalIssues = violationIssues.length + warningIssues.length + violations.length;

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

  if (totalIssues === 0) return null;

  const hasViolations = violationIssues.length > 0 || violations.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        key="conformity-panel"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={`
          flex flex-col w-72 bg-white border rounded-2xl shadow-2xl z-30 overflow-hidden
          ${hasViolations ? 'border-red-200' : 'border-amber-200'}
        `}
        style={{ maxHeight: 'calc(100vh - 120px)' }}
      >
        {/* ── Header (sticky) ─────────────────────────────── */}
        <div
          className={`flex items-center justify-between px-4 py-3 cursor-pointer shrink-0
            ${hasViolations ? 'bg-red-50' : 'bg-amber-50'}`}
          onClick={() => setIsOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${hasViolations ? 'text-red-500' : 'text-amber-500'}`} />
            <span className={`text-xs font-bold ${hasViolations ? 'text-red-800' : 'text-amber-800'}`}>
              {violationIssues.length + violations.length > 0
                ? `${violationIssues.length + violations.length} încălcări`
                : ''}
              {violationIssues.length + violations.length > 0 && warningIssues.length > 0 ? ' · ' : ''}
              {warningIssues.length > 0 ? `${warningIssues.length} recomandări` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {isOpen
              ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            }
            {/* X — întotdeauna vizibil, nu afectat de collapse */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Ascunde panoul complet resetând starea locală
                setIsOpen(false);
                setAiExplanation('');
              }}
              className="p-1 rounded-lg hover:bg-black/10 transition-colors ml-1"
              title="Închide"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── Body scrollabil ─────────────────────────────── */}
        {isOpen && (
          <div className="overflow-y-auto flex-1 p-4 space-y-3">

            {/* Violări (erori) */}
            {violationIssues.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Încălcări legale</p>
                {violationIssues.map((issue) => (
                  <div key={`${issue.code}-${issue.targetId}`} className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-slate-900 leading-snug">{issue.message}</div>
                      <div className="text-red-700 mt-0.5">
                        {issue.currentValue} → {issue.requiredValue}
                        {issue.deltaValue ? ` (−${Math.abs(issue.deltaValue)} lipsă)` : ''}
                      </div>
                      <div className="text-red-500 mt-1">{issue.suggestion}</div>
                      {renderSources(issue.sources)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Avertismente */}
            {warningIssues.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Recomandări</p>
                {warningIssues.map((issue) => (
                  <div key={`${issue.code}-${issue.targetId}`} className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs text-amber-800">
                      <div className="font-bold leading-snug">{issue.message}</div>
                      <div className="mt-1 text-amber-600">{issue.suggestion}</div>
                      {renderSources(issue.sources)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AI Explicație */}
            {(aiExplanation || isStreaming) && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  🤖 Zidario explică
                  {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-buildorange animate-pulse rounded-sm" />}
                </p>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {aiExplanation}
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
