import React, { useMemo } from 'react';
import { PIXELS_PER_METER } from '../../hooks/useEditorState';

// ─────────────────────────────────────────────────────────────────
// EditorRuler — Riglă metrică orizontală (sus) și verticală (stânga)
//
// Adaptivă la zoom:
//   zoom < 0.5x → ticks la 2m
//   zoom 0.5–1.5x → ticks la 1m (default)
//   zoom > 1.5x → ticks la 0.5m
//
// Intersecția stânga-sus (colțul 24×24px) afișează butonul
// „Fit Screen" (Ctrl+0) pentru reset zoom la 100%.
// ─────────────────────────────────────────────────────────────────

const RULER_SIZE = 24; // px — lățimea/înălțimea riglei

interface RulerProps {
  width: number;
  height: number;
  scale: number;          // canvasScale din Zustand
  offset: { x: number; y: number }; // canvasOffset din Zustand
  onFitScreen: () => void;
}

function getTickInterval(scale: number): number {
  if (scale > 1.5) return 0.5;  // ticks la 0.5m
  if (scale < 0.5) return 2;    // ticks la 2m
  return 1;                      // ticks la 1m
}

export const EditorRuler: React.FC<RulerProps> = ({
  width,
  height,
  scale,
  offset,
  onFitScreen,
}) => {
  const tickIntervalM = getTickInterval(scale);

  // ── Ticks orizontale ──────────────────────────────────────────
  const hTicks = useMemo(() => {
    const ticks: { x: number; label: string; major: boolean }[] = [];
    const startM = Math.floor(-offset.x / (PIXELS_PER_METER * scale) / tickIntervalM) * tickIntervalM;
    const endM = startM + width / (PIXELS_PER_METER * scale) + tickIntervalM * 2;

    for (let m = startM; m <= endM; m += tickIntervalM) {
      const x = m * PIXELS_PER_METER * scale + offset.x + RULER_SIZE;
      if (x < RULER_SIZE || x > width + RULER_SIZE) continue;
      const major = m % 5 === 0;
      ticks.push({ x, label: `${m}m`, major });
    }
    return ticks;
  }, [width, scale, offset.x, tickIntervalM]);

  // ── Ticks verticale ───────────────────────────────────────────
  const vTicks = useMemo(() => {
    const ticks: { y: number; label: string; major: boolean }[] = [];
    const startM = Math.floor(-offset.y / (PIXELS_PER_METER * scale) / tickIntervalM) * tickIntervalM;
    const endM = startM + height / (PIXELS_PER_METER * scale) + tickIntervalM * 2;

    for (let m = startM; m <= endM; m += tickIntervalM) {
      const y = m * PIXELS_PER_METER * scale + offset.y + RULER_SIZE;
      if (y < RULER_SIZE || y > height + RULER_SIZE) continue;
      const major = m % 5 === 0;
      ticks.push({ y, label: `${m}m`, major });
    }
    return ticks;
  }, [height, scale, offset.y, tickIntervalM]);

  return (
    <>
      {/* ── Riglă orizontală (sus) ──────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 bg-white border-b border-slate-200 overflow-hidden pointer-events-none select-none z-10"
        style={{ height: RULER_SIZE, left: RULER_SIZE }}
      >
        <svg width="100%" height={RULER_SIZE}>
          {hTicks.map((tick) => (
            <g key={tick.x}>
              <line
                x1={tick.x - RULER_SIZE}
                y1={tick.major ? 0 : RULER_SIZE / 2}
                x2={tick.x - RULER_SIZE}
                y2={RULER_SIZE}
                stroke={tick.major ? '#94a3b8' : '#cbd5e1'}
                strokeWidth={tick.major ? 1 : 0.5}
              />
              {tick.major && (
                <text
                  x={tick.x - RULER_SIZE + 2}
                  y={RULER_SIZE - 6}
                  fontSize={9}
                  fill="#64748b"
                  fontFamily="Inter, monospace"
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* ── Riglă verticală (stânga) ────────────────────────── */}
      <div
        className="absolute top-0 left-0 bottom-0 bg-white border-r border-slate-200 overflow-hidden pointer-events-none select-none z-10"
        style={{ width: RULER_SIZE, top: RULER_SIZE }}
      >
        <svg width={RULER_SIZE} height="100%">
          {vTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={tick.major ? 0 : RULER_SIZE / 2}
                y1={tick.y - RULER_SIZE}
                x2={RULER_SIZE}
                y2={tick.y - RULER_SIZE}
                stroke={tick.major ? '#94a3b8' : '#cbd5e1'}
                strokeWidth={tick.major ? 1 : 0.5}
              />
              {tick.major && (
                <text
                  x={RULER_SIZE - 4}
                  y={tick.y - RULER_SIZE - 2}
                  fontSize={9}
                  fill="#64748b"
                  fontFamily="Inter, monospace"
                  textAnchor="end"
                  transform={`rotate(-90, ${RULER_SIZE - 4}, ${tick.y - RULER_SIZE - 2})`}
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* ── Colț stânga-sus: buton Fit Screen ───────────────── */}
      <button
        onClick={onFitScreen}
        title="Fit Screen (Ctrl+0)"
        className="absolute top-0 left-0 z-20 bg-white border-r border-b border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-700"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
      >
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
          <rect x={0.5} y={0.5} width={4} height={4} rx={0.5} stroke="currentColor" strokeWidth={1} />
          <rect x={7.5} y={0.5} width={4} height={4} rx={0.5} stroke="currentColor" strokeWidth={1} />
          <rect x={0.5} y={7.5} width={4} height={4} rx={0.5} stroke="currentColor" strokeWidth={1} />
          <rect x={7.5} y={7.5} width={4} height={4} rx={0.5} stroke="currentColor" strokeWidth={1} />
        </svg>
      </button>
    </>
  );
};
