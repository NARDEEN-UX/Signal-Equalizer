/**
 * ECGAIViewer
 * ============
 * Renders the full AI-diagnosis UI for the ECG mode AI tab.
 * Probabilities from backend are 0-100 (percentage scale).
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { analyzeECGWithAI } from '../api';

const CLASS_COLORS = {
  Normal:     '#22c55e',
  AFib:       '#f97316',
  VTach:      '#ef4444',
  HeartBlock: '#a78bfa',
};
const CLASS_ORDER = ['Normal', 'AFib', 'VTach', 'HeartBlock'];

function heatColor(v) {
  const t = Math.max(0, Math.min(1, v));
  if (t < 0.25) { const s = t/0.25; return `rgb(0,${Math.round(s*255)},255)`; }
  if (t < 0.50) { const s = (t-0.25)/0.25; return `rgb(0,255,${Math.round((1-s)*255)})`; }
  if (t < 0.75) { const s = (t-0.50)/0.25; return `rgb(${Math.round(s*255)},255,0)`; }
  const s = (t-0.75)/0.25; return `rgb(255,${Math.round((1-s)*255)},0)`;
}

function GradCAMCanvas({ signal, cam }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !signal?.length || !cam?.length) return;
    const canvas = canvasRef.current;
    const W = Math.max(320, canvas.clientWidth || 600);
    const H = 130;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);

    const ribbonH = 28;
    const N = cam.length;
    const bw = W / N;
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = heatColor(cam[i]);
      ctx.fillRect(i * bw, H - ribbonH, Math.ceil(bw)+1, ribbonH);
    }

    const plotH = H - ribbonH - 8;
    const sigN  = Math.min(signal.length, cam.length);
    const slice = signal.slice(0, sigN);
    const minV  = Math.min(...slice), maxV = Math.max(...slice);
    const range = maxV - minV || 1;

    ctx.beginPath(); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.4;
    for (let i = 0; i < sigN; i++) {
      const x = (i/(sigN-1))*W;
      const y = plotH - ((slice[i]-minV)/range)*plotH + 4;
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();

    ctx.lineWidth = 2;
    for (let i = 1; i < sigN; i++) {
      const x0 = ((i-1)/(sigN-1))*W, x1 = (i/(sigN-1))*W;
      const y0 = plotH-((slice[i-1]-minV)/range)*plotH+4;
      const y1 = plotH-((slice[i]  -minV)/range)*plotH+4;
      ctx.beginPath();
      ctx.strokeStyle = heatColor(cam[i]);
      ctx.globalAlpha = 0.65;
      ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [signal, cam]);
  return <canvas ref={canvasRef} style={{ width:'100%', height:'130px', borderRadius:'6px', display:'block' }} />;
}

function WindowStrip({ windows }) {
  if (!windows?.length) return null;
  const totalDur = windows[windows.length-1].end_t || 1;
  return (
    <div style={{ position:'relative', width:'100%', height:'34px', background:'#1e293b', borderRadius:'6px', overflow:'hidden' }}>
      {windows.map((w,i) => {
        const left  = (w.start_t/totalDur)*100;
        const width = ((w.end_t-w.start_t)/totalDur)*100;
        const confNorm = (w.confidence||0)/100;  // confidence is 0-100
        return (
          <div key={i}
            title={`${w.pred} (${(w.confidence||0).toFixed(1)}%) @ ${w.mid_t.toFixed(2)}s`}
            style={{
              position:'absolute', left:`${left}%`, width:`${width}%`,
              top:0, bottom:0,
              background: CLASS_COLORS[w.pred]||'#64748b',
              opacity: 0.6 + confNorm*0.4,
              borderRight:'1px solid rgba(0,0,0,0.4)',
            }}
          />
        );
      })}
    </div>
  );
}

// probabilities values are 0-100
function ProbBars({ probabilities }) {
  if (!probabilities) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
      {CLASS_ORDER.map(cls => {
        const pct = Number(probabilities[cls]||0);
        return (
          <div key={cls}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#94a3b8', marginBottom:'2px' }}>
              <span style={{ color:CLASS_COLORS[cls] }}>{cls}</span>
              <span>{pct.toFixed(1)}%</span>
            </div>
            <div style={{ height:'7px', background:'#1e293b', borderRadius:'3px', overflow:'hidden' }}>
              <div style={{ width:`${Math.min(pct,100)}%`, height:'100%', background:CLASS_COLORS[cls]||'#6366f1', borderRadius:'3px', transition:'width 0.5s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FreqBars({ freqImportance, limit=6 }) {
  if (!freqImportance?.length) return <p style={{ color:'#64748b', fontSize:'12px' }}>No frequency data.</p>;
  const items  = freqImportance.slice(0, limit);
  const maxImp = Math.max(...items.map(f => f.importance ?? f.total_importance ?? 0), 1);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
      {items.map((f,i) => {
        const imp = f.importance ?? f.total_importance ?? 0;
        const pct = (imp/maxImp)*100;
        return (
          <div key={i}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#94a3b8', marginBottom:'2px' }}>
              <span>{f.hz} Hz ({f.bpm} BPM)</span>
              <span>{imp.toFixed(1)}</span>
            </div>
            <div style={{ height:'8px', background:'#1e293b', borderRadius:'4px', overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,#6366f1,#a78bfa)', borderRadius:'4px' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Numerical summary matching notebook terminal output
function NumericalSummary({ result }) {
  if (!result) return null;
  return (
    <div style={{ fontFamily:'monospace', fontSize:'11px', color:'#94a3b8', background:'#0f172a', borderRadius:'6px', padding:'10px 12px', lineHeight:'1.7' }}>
      <div style={{ color:'#e2e8f0', fontWeight:700, marginBottom:'4px' }}>
        Classification: <span style={{ color:CLASS_COLORS[result.pred_label]||'#fff' }}>{result.pred_label}</span>
        {'   '}Confidence: <span style={{ color:'#f1f5f9' }}>{Number(result.confidence).toFixed(2)}%</span>
      </div>
      {(result.is_long ? result.global_freq_importance : result.freq_importance)?.length > 0 && (
        <>
          <div style={{ color:'#e2e8f0', marginTop:'6px', marginBottom:'2px' }}>Important Frequencies:</div>
          {(result.is_long ? result.global_freq_importance : result.freq_importance).map((f,i) => (
            <div key={i}>{(f.hz||0).toFixed(2)} Hz  ({f.bpm} BPM)  — {(f.importance??f.total_importance??0).toFixed(1)}</div>
          ))}
        </>
      )}
      {(result.is_long ? result.time_importance_peaks : result.time_importance)?.length > 0 && (
        <>
          <div style={{ color:'#e2e8f0', marginTop:'6px', marginBottom:'2px' }}>Important Time Regions:</div>
          {(result.is_long ? result.time_importance_peaks : result.time_importance).map((t,i) => (
            <div key={i}>{(t.time_s||0).toFixed(2)}s  — Activation: {(t.activation||0).toFixed(1)}%</div>
          ))}
        </>
      )}
      {result.is_long && (
        <div style={{ marginTop:'6px', color:'#64748b' }}>
          Windows: {result.window_count}  ·  Dominant: {result.dominant_class}
        </div>
      )}
    </div>
  );
}

function TimeImportanceDots({ timeImportance, duration }) {
  if (!timeImportance?.length) return <p style={{ color:'#64748b', fontSize:'12px' }}>No time data.</p>;
  const maxAct = Math.max(...timeImportance.map(t => t.activation), 1);
  const dur    = duration || timeImportance[timeImportance.length-1]?.time_s || 1;
  return (
    <div style={{ position:'relative', width:'100%', height:'56px', background:'#1e293b', borderRadius:'6px', overflow:'hidden' }}>
      <div style={{ position:'absolute', bottom:'50%', left:0, right:0, borderTop:'1px solid #334155' }} />
      {timeImportance.map((t,i) => {
        const left = (t.time_s/dur)*100;
        const size = 6 + (t.activation/maxAct)*12;
        const top  = 50 - (t.activation/maxAct)*42;
        return (
          <div key={i}
            title={`${t.time_s.toFixed(2)}s — ${t.activation.toFixed(1)}%`}
            style={{
              position:'absolute', left:`${left}%`, top:`${top}%`,
              width:`${size}px`, height:`${size}px`, borderRadius:'50%',
              background:'#f97316', transform:'translate(-50%,-50%)',
              boxShadow:'0 0 6px rgba(249,115,22,0.7)',
            }}
          />
        );
      })}
    </div>
  );
}

function TimeAxis({ duration, ticks = 6 }) {
  const dur = Math.max(0.5, Number(duration) || 1);
  const marks = Array.from({ length: ticks + 1 }, (_, i) => {
    const r = i / ticks;
    return {
      key: i,
      left: `${r * 100}%`,
      label: `${(r * dur).toFixed(1)}s`
    };
  });

  return (
    <div style={{ position:'relative', height:'16px', marginTop:'4px' }}>
      {marks.map((m) => (
        <span
          key={m.key}
          style={{
            position:'absolute',
            left:m.left,
            top:0,
            transform:'translateX(-50%)',
            fontSize:'10px',
            color:'#64748b',
            whiteSpace:'nowrap'
          }}
        >
          {m.label}
        </span>
      ))}
    </div>
  );
}

function valueToY(v, maxV, chartH = 170, padTop = 12, padBottom = 20) {
  const plotH = chartH - padTop - padBottom;
  return padTop + (1 - (v / (maxV || 1))) * plotH;
}

function pointsToPolyline(points) {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

function NotebookTimeImportance({ camTimeline, peaks, duration, dominant }) {
  const W = 1000;
  const H = 190;
  const dur = Math.max(0.1, Number(duration) || 1);
  const line = Array.isArray(camTimeline) ? camTimeline : [];
  const pts = line.map((v, i) => ({
    x: (i / Math.max(1, line.length - 1)) * W,
    y: valueToY(Math.max(0, Math.min(1, Number(v) || 0)), 1, H, 16, 28)
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '190px', display: 'block', borderRadius: '6px', background: '#0f172a' }}>
      <line x1="0" y1="162" x2={W} y2="162" stroke="#334155" strokeWidth="1" />
      {pts.length > 1 && (
        <>
          <polyline points={pointsToPolyline(pts)} fill="none" stroke="#58A6FF" strokeWidth="1.8" />
          <polyline points={`0,162 ${pointsToPolyline(pts)} ${W},162`} fill="rgba(88,166,255,0.20)" stroke="none" />
        </>
      )}
      {(peaks || []).slice(0, 5).map((pk, idx) => {
        const t = Math.max(0, Math.min(dur, Number(pk.time_s) || 0));
        const x = (t / dur) * W;
        const y = valueToY(Math.max(0, Math.min(1, (Number(pk.activation) || 0) / 100)), 1, H, 16, 28);
        const c = CLASS_COLORS[dominant] || '#ef4444';
        return (
          <g key={`pk-${idx}`}>
            <line x1={x} y1="16" x2={x} y2="162" stroke={c} strokeWidth="1.1" strokeDasharray="4 3" opacity="0.85" />
            <circle cx={x} cy={y} r="4.5" fill={c} />
            <text x={Math.min(W - 110, x + 6)} y={Math.max(14, y - 8)} fill={c} fontSize="10" fontFamily="monospace">#{idx + 1} {t.toFixed(2)}s</text>
          </g>
        );
      })}
    </svg>
  );
}

function NotebookClassProbabilities({ windows, duration }) {
  const W = 1000;
  const H = 190;
  const dur = Math.max(0.1, Number(duration) || 1);
  const mid = (windows || []).map((w) => Math.max(0, Number(w.mid_t) || 0));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '190px', display: 'block', borderRadius: '6px', background: '#0f172a' }}>
      <line x1="0" y1="162" x2={W} y2="162" stroke="#334155" strokeWidth="1" />
      {CLASS_ORDER.map((cls, ci) => {
        const pts = (windows || []).map((w, i) => {
          const x = (mid[i] / dur) * W;
          const raw = Array.isArray(w.probs) ? Number(w.probs[ci]) || 0 : 0;
          const p = raw > 1 ? raw / 100 : raw;
          return { x, y: valueToY(Math.max(0, Math.min(1, p)), 1, H, 14, 28) };
        });
        if (pts.length < 2) return null;
        return <polyline key={`prob-${cls}`} points={pointsToPolyline(pts)} fill="none" stroke={CLASS_COLORS[cls]} strokeWidth="2" opacity="0.95" />;
      })}
      {CLASS_ORDER.map((cls, i) => (
        <g key={`legend-${cls}`}>
          <rect x={790 + i * 52} y="10" width="10" height="10" fill={CLASS_COLORS[cls]} />
          <text x={804 + i * 52} y="19" fill="#94a3b8" fontSize="10">{cls}</text>
        </g>
      ))}
    </svg>
  );
}

function NotebookTopFreqScatter({ windows, duration }) {
  const W = 1000;
  const H = 190;
  const dur = Math.max(0.1, Number(duration) || 1);
  const tops = (windows || []).map((w) => ({
    mid: Math.max(0, Number(w.mid_t) || 0),
    pred: w.pred,
    top: Array.isArray(w.freq_info) && w.freq_info.length ? w.freq_info[0] : null
  })).filter((r) => r.top);
  const maxHz = Math.max(5, ...tops.map((r) => Number(r.top.hz) || 0));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '190px', display: 'block', borderRadius: '6px', background: '#0f172a' }}>
      <line x1="0" y1="162" x2={W} y2="162" stroke="#334155" strokeWidth="1" />
      {[0.25, 0.5, 0.75, 1].map((r, i) => (
        <line key={`grid-${i}`} x1="0" y1={valueToY(maxHz * r, maxHz, H, 14, 28)} x2={W} y2={valueToY(maxHz * r, maxHz, H, 14, 28)} stroke="#1e293b" strokeWidth="1" />
      ))}
      {tops.map((r, i) => {
        const x = (r.mid / dur) * W;
        const hz = Number(r.top.hz) || 0;
        const imp = Number(r.top.importance ?? r.top.total_importance ?? 0) || 0;
        const bpm = Number(r.top.bpm) || Math.round(hz * 60);
        const y = valueToY(hz, maxHz, H, 14, 28);
        const rad = Math.max(3, Math.min(10, 3 + imp / 20));
        const c = CLASS_COLORS[r.pred] || '#94a3b8';
        return (
          <g key={`freq-${i}`}>
            <circle cx={x} cy={y} r={rad} fill={c} opacity="0.9" />
            <text x={x} y={Math.max(10, y - 9)} fill={c} fontSize="9" textAnchor="middle">{bpm}BPM</text>
          </g>
        );
      })}
    </svg>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop:'16px' }}>
      <h4 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.08em', color:'#64748b', marginBottom:'8px' }}>{title}</h4>
      {children}
    </div>
  );
}

function GraphFrame({ children }) {
  return (
    <div style={{ background:'rgba(15,23,42,0.72)', border:'1px solid rgba(71,85,105,0.32)', borderRadius:'10px', padding:'10px 12px' }}>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ECGAIViewer({ signal, sampleRate, onStateChange }) {
  const [state, setState] = useState({ loading:false, error:null, result:null });

  const run = useCallback(async () => {
    if (!signal?.length) {
      setState({ loading:false, error:'Upload an ECG signal first.', result:null });
      return;
    }
    setState({ loading:true, error:null, result:null });
    try {
      const resp = await analyzeECGWithAI(signal, sampleRate||360);
      setState({ loading:false, error:null, result:resp.data });
    } catch (err) {
      setState({ loading:false, error:err?.response?.data?.detail||err?.message||'AI diagnosis failed.', result:null });
    }
  }, [signal, sampleRate]);

  const { loading, error, result } = state;
  const signalDuration = signal?.length ? signal.length/(sampleRate||360) : null;

  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  return (
    <div style={{ padding:'4px 0' }}>

      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
        <button type="button" className="btn btn-small" onClick={run} disabled={loading} style={{ minWidth:'150px' }}>
          {loading ? (
            <><span style={{ display:'inline-block', width:'12px', height:'12px', border:'2px solid #6366f1', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite', marginRight:'6px' }} />Analysing…</>
          ) : '🧠 Run AI Diagnosis'}
        </button>
        {!signal?.length && <span style={{ fontSize:'11px', color:'#64748b' }}>Upload an ECG WAV file first.</span>}
        {signal?.length > 0 && !loading && !result && (
          <span style={{ fontSize:'11px', color:'#64748b' }}>{signal.length} samples · {signalDuration?.toFixed(1)}s @ {sampleRate||360} Hz</span>
        )}
      </div>

      {error && (
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'6px', padding:'10px 12px', fontSize:'12px', color:'#fca5a5', marginBottom:'12px' }}>
          ⚠ {error}
        </div>
      )}

      {result && (
        <>
          {/* Diagnosis card */}
          <div style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${CLASS_COLORS[result.pred_label]||'#6366f1'}44`, borderRadius:'10px', padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px', flexWrap:'wrap' }}>
              <div style={{ background:CLASS_COLORS[result.pred_label]||'#6366f1', color:'#fff', fontWeight:700, fontSize:'13px', borderRadius:'6px', padding:'4px 10px' }}>
                {result.pred_label}
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize:'22px', fontWeight:800, color:'#f1f5f9', lineHeight:'1.1' }}>{Number(result.confidence).toFixed(1)}%</span>
                <span style={{ fontSize:'11px', color:'#64748b', marginLeft:'6px' }}>confidence</span>
              </div>
              {result.is_long && (
                <div style={{ width:'100%', fontSize:'11px', color:'#94a3b8', textAlign:'right', lineHeight:'1.2' }}>
                  {result.window_count} windows · {signalDuration?.toFixed(1)}s
                </div>
              )}
            </div>
            <ProbBars probabilities={result.probabilities} />
          </div>

          <Section title="Numerical Summary"><NumericalSummary result={result} /></Section>

        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ECGAIComparisonGraphs({ result, signal, sampleRate = 360 }) {
  if (!result) return null;

  const signalDuration = signal?.length ? signal.length / (sampleRate || 360) : null;
  const timelineDuration = signalDuration
    || result?.windows?.[result.windows.length - 1]?.end_t
    || 5;
  const hasWindowSeries = Boolean(result.is_long && Array.isArray(result.windows) && result.windows.length > 0);

  const topNotebookPeaks = useMemo(() => {
    const arr = result.is_long ? result.time_importance_peaks : result.time_importance;
    return (Array.isArray(arr) ? arr : []).slice(0, 5);
  }, [result]);

  return (
    <div style={{ padding:'2px 0' }}>

      <Section title="GradCAM - Signal Activation Heatmap">
        <GraphFrame>
          <GradCAMCanvas signal={signal?.slice(0, result.gradcam?.length)} cam={result.gradcam} />
          <TimeAxis duration={timelineDuration} />
          <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end', marginTop:'4px' }}>
            {['Low','','Medium','','High'].map((lbl,i) => (
              <span key={i} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'10px', color:'#64748b' }}>
                <span style={{ width:'14px', height:'6px', borderRadius:'2px', background:heatColor(i*0.25), display:'inline-block' }} />{lbl}
              </span>
            ))}
          </div>
        </GraphFrame>
      </Section>

      <Section title="Frequency Importance (GradCAM-weighted FFT)">
        <GraphFrame>
          <FreqBars freqImportance={result.is_long ? result.global_freq_importance : result.freq_importance} />
        </GraphFrame>
      </Section>

      {hasWindowSeries && (
        <>
          <Section title="Aggregated Time Importance (Top Peaks)">
            <GraphFrame>
              <NotebookTimeImportance
                camTimeline={result.cam_timeline}
                peaks={topNotebookPeaks}
                duration={timelineDuration}
                dominant={result.dominant_class || result.pred_label}
              />
              <TimeAxis duration={timelineDuration} />
            </GraphFrame>
          </Section>

          <Section title="Class Probability Over Time">
            <GraphFrame>
              <NotebookClassProbabilities windows={result.windows} duration={timelineDuration} />
              <TimeAxis duration={timelineDuration} />
            </GraphFrame>
          </Section>

          <Section title="Per-window Top-1 Important Frequency">
            <GraphFrame>
              <NotebookTopFreqScatter windows={result.windows} duration={timelineDuration} />
              <TimeAxis duration={timelineDuration} />
            </GraphFrame>
          </Section>

          <Section title="Window Predictions Strip">
            <GraphFrame>
              <WindowStrip windows={result.windows} />
              <TimeAxis duration={timelineDuration} />
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginTop:'6px' }}>
                {CLASS_ORDER.map(cls => (
                  <span key={cls} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'10px', color:'#94a3b8' }}>
                    <span style={{ width:'10px', height:'10px', borderRadius:'2px', background:CLASS_COLORS[cls], display:'inline-block' }} />{cls}
                  </span>
                ))}
              </div>
            </GraphFrame>
          </Section>
        </>
      )}

      {!hasWindowSeries && (
        <Section title="Time Activation Peaks">
          <GraphFrame>
            <TimeImportanceDots
              timeImportance={result.is_long ? result.time_importance_peaks : result.time_importance}
              duration={timelineDuration}
            />
            <TimeAxis duration={timelineDuration} />
          </GraphFrame>
        </Section>
      )}
    </div>
  );
}