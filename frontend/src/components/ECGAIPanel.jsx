import React, { useState, useCallback } from 'react';

const LABELS = ['Normal', 'Atrial Fib', 'V-Tach', 'Heart Block'];

const LABEL_COLORS = {
  Normal:       '#22c55e',
  'Atrial Fib': '#f97316',
  'V-Tach':     '#ef4444',
  'Heart Block':'#a855f7',
};

const FEATURE_LABELS = {
  heart_rate_bpm: 'Heart Rate (bpm)',
  sdnn_ms:        'SDNN (ms)',
  rmssd_ms:       'RMSSD (ms)',
  pnn50_pct:      'pNN50 (%)',
  qrs_width_ms:   'QRS Width (ms)',
  cov_rr:         'RR CoV',
  dropped_beats:  'Dropped Beats',
  n_beats:        'Beats Detected',
};

// Normal reference ranges for colouring feature values
const FEATURE_RANGES = {
  heart_rate_bpm: [60, 100],
  sdnn_ms:        [20, 50],
  rmssd_ms:       [15, 50],
  pnn50_pct:      [0, 20],
  qrs_width_ms:   [70, 120],
  cov_rr:         [0, 0.08],
  dropped_beats:  [0, 0],
};

function featureColor(key, val) {
  if (!(key in FEATURE_RANGES)) return '#94a3b8';
  const [lo, hi] = FEATURE_RANGES[key];
  return val >= lo && val <= hi ? '#22c55e' : '#f97316';
}

const ECGAIPanel = ({ signalData, onApplyGains }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = useCallback(async () => {
    if (!signalData?.input_signal) return;
    setLoading(true);
    setError(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/modes/ecg/ai-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal: signalData.output_signal,
          sample_rate: 500,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Request failed');
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [signalData]);

  const handleApply = () => {
    if (result?.suggested_gains) {
      onApplyGains(result.suggested_gains);
    }
  };

  const scores = result?.scores ?? {};
  const features = result?.features ?? {};
  const predicted = scores.predicted;
  const maxScore = Math.max(
    ...LABELS.map(l => scores[l] ?? 0), 0.01
  );

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div>
          <div className="ai-panel-title">AI Arrhythmia Classifier</div>
          <div className="ai-panel-subtitle">
            Analyses the equalised output · Pan-Tompkins · MIT-BIH thresholds
          </div>
        </div>
        <button
          className="btn btn-small primary"
          onClick={handleAnalyze}
          disabled={loading || !signalData?.input_signal}
        >
          {loading ? 'Analysing…' : 'Run AI'}
        </button>
      </div>

      {error && (
        <div className="ai-error">⚠ {error}</div>
      )}

      {result && (
        <>
          {/* Prediction badge */}
          <div className="ai-prediction" style={{ borderColor: LABEL_COLORS[predicted] ?? '#64748b' }}>
            <span className="ai-pred-label">Prediction</span>
            <span className="ai-pred-value" style={{ color: LABEL_COLORS[predicted] ?? '#e2e8f0' }}>
              {predicted}
            </span>
            <span className="ai-pred-conf">
              {((scores[predicted] ?? 0) * 100).toFixed(0)}% confidence
            </span>
          </div>

          {/* Score bars */}
          <div className="ai-scores">
            {LABELS.map(label => {
              const score = scores[label] ?? 0;
              const pct = (score / maxScore) * 100;
              return (
                <div key={label} className="ai-score-row">
                  <span className="ai-score-label">{label}</span>
                  <div className="ai-score-track">
                    <div
                      className="ai-score-fill"
                      style={{
                        width: `${pct}%`,
                        background: LABEL_COLORS[label] ?? '#64748b',
                        opacity: label === predicted ? 1 : 0.55,
                      }}
                    />
                  </div>
                  <span className="ai-score-val">{(score * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>

          {/* Feature table */}
          <div className="ai-features">
            <div className="ai-feat-title">Extracted Features</div>
            <div className="ai-feat-grid">
              {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                const val = features[key];
                if (val == null) return null;
                const display = typeof val === 'number' ? val.toFixed(key === 'cov_rr' ? 3 : 1) : val;
                return (
                  <div key={key} className="ai-feat-row">
                    <span className="ai-feat-key">{label}</span>
                    <span className="ai-feat-val" style={{ color: featureColor(key, val) }}>
                      {display}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Apply suggested gains */}
          <button className="btn btn-small" onClick={handleApply} style={{ width: '100%', marginTop: '0.5rem' }}>
            Apply AI-suggested Gains
          </button>
        </>
      )}

      {!result && !loading && (
        <div className="ai-idle">
          Click <strong>Run AI</strong> to analyse the ECG signal and detect arrhythmia components.
        </div>
      )}
    </div>
  );
};

export default ECGAIPanel;
