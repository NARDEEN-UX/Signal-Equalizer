import React, { useMemo } from 'react';
import {
  formatFrequency,
  createExclusiveBandToLevelMap
} from '../utils/waveletMath';
import { getModeBands } from '../config/modeWaveletConfig';

const MAX_POINTS = 280;

const downsample = (arr) => {
  if (!Array.isArray(arr) || arr.length <= MAX_POINTS) return arr || [];
  const step = Math.max(1, Math.floor(arr.length / MAX_POINTS));
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  return out;
};

const toNumericSeries = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => Number(v) || 0);
};

const resampleLinear = (series, targetLength) => {
  const src = toNumericSeries(series);
  const n = Math.max(0, Number(targetLength) || 0);
  if (n === 0 || src.length === 0) return [];
  if (src.length === n) return src.slice();
  if (src.length === 1) return Array.from({ length: n }, () => src[0]);

  const out = Array.from({ length: n }, () => 0);
  const last = src.length - 1;

  for (let i = 0; i < n; i += 1) {
    const pos = (i * last) / Math.max(1, n - 1);
    const left = Math.floor(pos);
    const right = Math.min(last, left + 1);
    const frac = pos - left;
    out[i] = src[left] * (1 - frac) + src[right] * frac;
  }

  return out;
};

const combineLevels = (coeffs, levels, targetLength) => {
  if (!Array.isArray(coeffs) || coeffs.length === 0 || !Array.isArray(levels) || levels.length === 0) {
    return [];
  }

  const n = Math.max(64, Math.min(4096, Number(targetLength) || 0));
  const out = Array.from({ length: n }, () => 0);

  levels.forEach((lv) => {
    const idx = Math.max(0, Number(lv) - 1);
    const levelSeries = Array.isArray(coeffs[idx]) ? coeffs[idx] : [];
    const resized = resampleLinear(levelSeries, n);
    for (let i = 0; i < out.length; i += 1) {
      out[i] += resized[i] || 0;
    }
  });

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

/**
 * WaveletBandViewer
 * 
 * Displays waveforms for each frequency band (matching level viewer design).
 * Shows input/output waveforms filtered to band frequency range.
 * 
 * Props:
 *   @param {string} currentMode - Mode ID (music, animals, humans, ecg)
 *   @param {array} inputSignal - Input audio signal
 *   @param {array} outputSignal - Output audio (equalized) signal
 *   @param {string} selectedWavelet - Current wavelet type
 *   @param {array} waveletSliders - Gain values for each level
 *   @param {number} sampleRate - Audio sample rate
 *   @param {number} maxLevel - Maximum decomposition level
 */
const WaveletBandViewer = ({
  currentMode,
  inputSignal = [],
  outputSignal = [],
  waveletBandData = [],
  waveletData = null,
  selectedWavelet = 'db4',
  waveletSliders = [],
  sampleRate = 44100,
  maxLevel = 6
}) => {
  const bands = getModeBands(currentMode);

  const exclusiveBandToLevelMap = useMemo(() => {
    const w = String(selectedWavelet || 'db4').toLowerCase().trim();
    return createExclusiveBandToLevelMap(bands, maxLevel, sampleRate, true, w);
  }, [bands, maxLevel, sampleRate, selectedWavelet]);

  const waveletBands = useMemo(() => {
    const inputCoeffs = Array.isArray(waveletData?.input_coeffs) ? waveletData.input_coeffs : [];
    const outputCoeffs = Array.isArray(waveletData?.output_coeffs) ? waveletData.output_coeffs : [];

    if (inputCoeffs.length > 0 && outputCoeffs.length > 0) {
      return bands
        .map((band, idx) => {
          const low = Number(band?.low) || 0;
          const high = Number(band?.high) || 0;
          const levels = exclusiveBandToLevelMap[idx] || [];

          const maxLevelLen = levels.reduce((m, lv) => {
            const inLen = Array.isArray(inputCoeffs[lv - 1]) ? inputCoeffs[lv - 1].length : 0;
            const outLen = Array.isArray(outputCoeffs[lv - 1]) ? outputCoeffs[lv - 1].length : 0;
            return Math.max(m, inLen, outLen);
          }, 0);

          const fallbackLength = Math.max(
            256,
            Math.min(
              4096,
              maxLevelLen || Math.max((Array.isArray(inputSignal) ? inputSignal.length : 0), (Array.isArray(outputSignal) ? outputSignal.length : 0), 512)
            )
          );

          const input = combineLevels(inputCoeffs, levels, fallbackLength);
          const output = combineLevels(outputCoeffs, levels, fallbackLength);

          return {
            id: String(band?.id || `${currentMode}-${idx}`),
            name: String(band?.name || `Band ${idx + 1}`),
            low,
            high,
            levels,
            input,
            output
          };
        })
        .filter((band) => Number.isFinite(band.low) && Number.isFinite(band.high) && band.high > band.low);
    }

    if (Array.isArray(waveletBandData) && waveletBandData.length > 0) {
      return waveletBandData
        .map((band, idx) => {
          const low = Number(band?.low);
          const high = Number(band?.high);
          const name = String(band?.name || `Band ${idx + 1}`);
          const levels = Array.isArray(band?.levels) ? band.levels : [];
          const input = Array.isArray(band?.input) ? band.input : [];
          const output = Array.isArray(band?.output) ? band.output : [];
          return {
            id: String(band?.id || `${currentMode}-${idx}`),
            name,
            low: Number.isFinite(low) ? low : 0,
            high: Number.isFinite(high) ? high : 0,
            levels,
            input,
            output
          };
        })
        .filter((band) => Number.isFinite(band.low) && Number.isFinite(band.high) && band.high > band.low);
    }

    return bands
      .map((band, idx) => ({
        id: String(band?.id || `${currentMode}-${idx}`),
        name: String(band?.name || `Band ${idx + 1}`),
        low: Number(band?.low) || 0,
        high: Number(band?.high) || 0,
        levels: [],
        input: [],
        output: []
      }))
      .filter((band) => Number.isFinite(band.low) && Number.isFinite(band.high) && band.high > band.low);
  }, [bands, currentMode, exclusiveBandToLevelMap, inputSignal, maxLevel, outputSignal, sampleRate, waveletBandData, waveletData]);

  if (!waveletBands || waveletBands.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
        No band visualization data available
      </div>
    );
  }

  // Check if we have signal data
  const hasSignalData = waveletBands.some(
    (band) => Array.isArray(band.input) && band.input.length > 0 && Array.isArray(band.output) && band.output.length > 0
  );

  return (
    <div className="chart-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {!hasSignalData && (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
          Load an audio file to see band waveforms
        </div>
      )}
      {waveletBands.map((band, bandIdx) => {
        const inValues = Array.isArray(band.input) ? band.input : [];
        const outValues = Array.isArray(band.output) ? band.output : [];
        const inSamples = downsample(inValues).map((v) => Number(v) || 0);
        const inputScaleMax = Math.max(1e-8, inSamples.reduce((m, v) => Math.max(m, Math.abs(v)), 0));
        const levelHint = Array.isArray(band.levels) && band.levels.length > 0
          ? `Levels: ${band.levels.map((lv) => `L${lv}`).join(', ')}`
          : 'No overlapping levels';
        
        return (
          <div key={band.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#c9c9c9', fontWeight: 700 }} title={levelHint}>
              {band.name} ({formatFrequency(band.low)} - {formatFrequency(band.high)})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#9aa0a6', marginBottom: '0.2rem' }}>Input</div>
                <MiniWaveform values={inValues} color="#9aa0a6" scaleMax={inputScaleMax} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#d64545', marginBottom: '0.2rem' }}>Output</div>
                <MiniWaveform values={outValues} color="#d64545" scaleMax={inputScaleMax} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WaveletBandViewer;
