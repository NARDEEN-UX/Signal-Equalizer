import React from 'react';

const MAX_POINTS = 280;

const downsample = (arr) => {
  if (!Array.isArray(arr) || arr.length <= MAX_POINTS) return arr || [];
  const step = Math.max(1, Math.floor(arr.length / MAX_POINTS));
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  return out;
};

const makePath = (series, width, height, fixedMaxAbs) => {
  if (!Array.isArray(series) || !series.length) return '';
  const samples = downsample(series).map((v) => Number(v) || 0);
  const ownMax = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-8);
  const maxAbs = Math.max(1e-8, Number(fixedMaxAbs) || ownMax);
  const midY = height / 2;
  const amp = (height / 2) - 4;

  return samples
    .map((v, i) => {
      const x = (i / Math.max(1, samples.length - 1)) * width;
      const y = midY - (v / maxAbs) * amp;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const MiniWaveform = ({ values, color, scaleMax }) => {
  const width = 440;
  const height = 72;
  const path = makePath(values, width, height, scaleMax);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '72px', display: 'block', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {path && <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />}
    </svg>
  );
};

/** Renders stacked per-level coefficient waveform plots (input gray vs output red). */
const WaveletChart = ({ data }) => {
  const levels = Array.isArray(data?.levels) ? data.levels : [];
  const inputCoeffs = Array.isArray(data?.input_coeffs) ? data.input_coeffs : [];
  const outputCoeffs = Array.isArray(data?.output_coeffs) ? data.output_coeffs : [];

  if (!levels.length || !inputCoeffs.length || !outputCoeffs.length) {
    return <div className="chart-wrap">No wavelet coefficient data</div>;
  }

  const count = Math.min(6, levels.length, inputCoeffs.length, outputCoeffs.length);

  return (
    <div className="chart-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {Array.from({ length: count }).map((_, i) => {
        const levelLabel = String(levels[i] || `L${i + 1}`);
        const inSamples = downsample(Array.isArray(inputCoeffs[i]) ? inputCoeffs[i] : []).map((v) => Number(v) || 0);
        const inputScaleMax = Math.max(1e-8, inSamples.reduce((m, v) => Math.max(m, Math.abs(v)), 0));
        return (
          <div key={`${levelLabel}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#c9c9c9', fontWeight: 700 }}>{levelLabel}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#9aa0a6', marginBottom: '0.2rem' }}>Input</div>
                <MiniWaveform values={inputCoeffs[i]} color="#9aa0a6" scaleMax={inputScaleMax} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#d64545', marginBottom: '0.2rem' }}>Output</div>
                <MiniWaveform values={outputCoeffs[i]} color="#d64545" scaleMax={inputScaleMax} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WaveletChart;
