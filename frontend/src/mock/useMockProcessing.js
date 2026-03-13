import { useEffect, useMemo, useState } from 'react';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function linspace(n, start, end) {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + i * step);
}

function makeSyntheticMix(fs, seconds) {
  const n = Math.floor(fs * seconds);
  const t = linspace(n, 0, seconds);

  // 4 synthetic "voices" with different spectral emphasis.
  const v1 = t.map((x) => 0.22 * Math.sin(2 * Math.PI * 110 * x) + 0.08 * Math.sin(2 * Math.PI * 220 * x));
  const v2 = t.map((x) => 0.18 * Math.sin(2 * Math.PI * 220 * x) + 0.06 * Math.sin(2 * Math.PI * 440 * x));
  const v3 = t.map((x) => 0.10 * Math.sin(2 * Math.PI * 350 * x) + 0.10 * Math.sin(2 * Math.PI * 700 * x));
  const v4 = t.map((x) => 0.06 * Math.sin(2 * Math.PI * 120 * x) + 0.07 * Math.sin(2 * Math.PI * 4000 * x));

  const mix = v1.map((_, i) => v1[i] + v2[i] + v3[i] + v4[i]);
  return { time: t, voices: [v1, v2, v3, v4], mix };
}

function applyVoiceGains(voices, gains) {
  const g = gains.map((x) => clamp(Number(x) || 0, 0, 2));
  const n = voices[0]?.length || 0;
  const out = new Array(n).fill(0);
  for (let k = 0; k < voices.length; k += 1) {
    const v = voices[k];
    const gain = g[k] ?? 1;
    for (let i = 0; i < n; i += 1) out[i] += (v[i] || 0) * gain;
  }
  return out;
}

function pseudoFft(freqs, bands, gains) {
  const out = freqs.map(() => 0.02);
  for (let i = 0; i < freqs.length; i += 1) {
    const f = freqs[i];
    let mag = 0.02;
    for (let b = 0; b < bands.length; b += 1) {
      const [lo, hi] = bands[b];
      if (f >= lo && f <= hi) mag += 0.35 * (Number(gains[b]) || 1);
    }
    // smooth bump to look like a spectrum
    mag += 0.15 * Math.exp(-Math.pow((f - 600) / 900, 2));
    out[i] = mag;
  }
  return out;
}

function pseudoSpectrogram(rows, cols, tone = 0.6) {
  const a = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      const v = tone * (0.2 + 0.8 * Math.sin((c / cols) * Math.PI * 2) ** 2) * (r / rows);
      row.push(v);
    }
    a.push(row);
  }
  return a;
}

function pseudoWaveletEnergy(levels, gains) {
  const base = Array.from({ length: levels }, (_, i) => 0.3 + 0.15 * (levels - i));
  const out = base.map((v, i) => v * (Number(gains[i]) || 1));
  return { in: base, out };
}

/**
 * Frontend-only mock processor: returns data shaped exactly like backend `/process`.
 * This lets the UI satisfy the statement UX even before backend wiring.
 */
export function useMockProcessing({
  modeId,
  freqSliders,
  waveletSliders,
  genericBands,
  waveletType = 'haar'
}) {
  const fs = 44100;
  const seconds = 4;

  const input = useMemo(() => makeSyntheticMix(fs, seconds), []);
  const [data, setData] = useState(null);

  useEffect(() => {
    const bands =
      modeId === 'generic'
        ? (genericBands?.length
          ? genericBands.map((b) => [Number(b.low) || 0, Number(b.high) || 0])
          : [[80, 180], [180, 300], [300, 3000], [3000, 8000]])
        : [[80, 180], [180, 300], [300, 3000], [3000, 8000]];

    const gains = modeId === 'generic'
      ? (genericBands?.length ? genericBands.map((b) => Number(b.gain) || 1) : freqSliders)
      : freqSliders;

    // "Human": slider controls speakers (voices) more directly (better UX for the statement)
    const outputSignal =
      modeId === 'human'
        ? applyVoiceGains(input.voices, gains)
        : input.mix.map((x) => x * (0.7 + 0.15 * (Number(gains[0]) || 1)));

    // FFT/spectrogram/wavelet are mocked but responsive.
    const fftFreq = linspace(512, 0, 8000);
    const fftIn = pseudoFft(fftFreq, bands, [1, 1, 1, 1]);
    const fftOut = pseudoFft(fftFreq, bands, gains);

    const specT = linspace(120, 0, seconds);
    const specF = linspace(96, 0, 8000);
    const specIn = pseudoSpectrogram(specF.length, specT.length, 0.55);
    const tone = 0.35 + 0.25 * clamp((Number(gains[0]) || 1) / 2, 0, 1);
    const specOut = pseudoSpectrogram(specF.length, specT.length, tone);

    const w = pseudoWaveletEnergy(6, waveletSliders);

    // Simulate realistic compute delay (so loading states can exist)
    const id = window.setTimeout(() => {
      setData({
        time: input.time,
        input_signal: input.mix,
        output_signal: outputSignal,
        fft: { freq: fftFreq, in: fftIn, out: fftOut },
        spectrogram: { t: specT, f: specF, in: specIn, out: specOut },
        wavelet: { levels: Array.from({ length: 6 }, (_, i) => i), in: w.in, out: w.out }
      });
    }, 120);

    return () => window.clearTimeout(id);
  }, [freqSliders, waveletSliders, modeId, genericBands, waveletType, input]);

  return data;
}

