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

// ─── ECG Signal Synthesis ───────────────────────────────────────────────────

/** Gaussian pulse helper */
function gaussianPulse(t, center, width, amp) {
  const d = (t - center) / width;
  return amp * Math.exp(-0.5 * d * d);
}

/** Generate one PQRST heartbeat cycle centered around t=0, duration ~0.8s */
function pqrstBeat(t) {
  // P wave: small upward bump before QRS
  const p = gaussianPulse(t, -0.20, 0.035, 0.12);
  // Q wave: small downward dip
  const q = gaussianPulse(t, -0.04, 0.012, -0.08);
  // R wave: tall sharp upward spike
  const r = gaussianPulse(t, 0.0, 0.012, 1.0);
  // S wave: small downward dip after R
  const s = gaussianPulse(t, 0.035, 0.015, -0.15);
  // T wave: broad upward bump after QRS
  const tw = gaussianPulse(t, 0.18, 0.055, 0.25);
  return p + q + r + s + tw;
}

/**
 * Generate synthetic ECG with 4 separable components:
 *   0 – Normal sinus rhythm (clean PQRST at ~72 bpm)
 *   1 – Atrial Fibrillation component (irregular fibrillatory baseline)
 *   2 – Ventricular Tachycardia component (wide abnormal beats at high rate)
 *   3 – Heart Block component (slow rhythm with dropped beats)
 */
function makeEcgMix(fs, seconds) {
  const n = Math.floor(fs * seconds);
  const t = linspace(n, 0, seconds);
  const dt = 1 / fs;
  const bpm = 72;
  const beatInterval = 60.0 / bpm;

  // Component 0: Normal sinus rhythm
  const normal = new Array(n).fill(0);
  for (let beat = 0; beat < Math.ceil(seconds / beatInterval); beat++) {
    const center = beat * beatInterval + 0.3;
    // Only compute within ±0.4s of beat center (PQRST window)
    const iStart = Math.max(0, Math.floor((center - 0.4) * fs));
    const iEnd = Math.min(n, Math.ceil((center + 0.4) * fs));
    for (let i = iStart; i < iEnd; i++) {
      normal[i] += pqrstBeat(t[i] - center);
    }
  }

  // Component 1: Atrial Fibrillation – irregular rapid fibrillatory waves
  const afib = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    afib[i] =
      0.06 * Math.sin(2 * Math.PI * 6.3 * t[i] + 1.2) +
      0.04 * Math.sin(2 * Math.PI * 8.7 * t[i] + 0.5) +
      0.03 * Math.sin(2 * Math.PI * 12.1 * t[i] + 2.8) +
      0.025 * Math.sin(2 * Math.PI * 18.5 * t[i] + 0.3) +
      0.02 * Math.sin(2 * Math.PI * 23.0 * t[i]);
  }

  // Component 2: Ventricular Tachycardia – wide fast abnormal complexes (~180 bpm)
  const vtach = new Array(n).fill(0);
  const vtachInterval = 60.0 / 180;
  for (let beat = 0; beat < Math.ceil(seconds / vtachInterval); beat++) {
    const center = beat * vtachInterval + 0.15;
    const iStart = Math.max(0, Math.floor((center - 0.15) * fs));
    const iEnd = Math.min(n, Math.ceil((center + 0.15) * fs));
    for (let i = iStart; i < iEnd; i++) {
      const d = t[i] - center;
      vtach[i] += gaussianPulse(d, -0.01, 0.025, 0.5) + gaussianPulse(d, 0.03, 0.03, -0.35);
    }
  }

  // Component 3: Heart Block – extra slow rhythm component (dropped beats effect)
  const hblock = new Array(n).fill(0);
  const hbInterval = beatInterval * 2.5;
  for (let beat = 0; beat < Math.ceil(seconds / hbInterval); beat++) {
    const center = beat * hbInterval + 0.5;
    const iStart = Math.max(0, Math.floor((center - 0.25) * fs));
    const iEnd = Math.min(n, Math.ceil((center + 0.25) * fs));
    for (let i = iStart; i < iEnd; i++) {
      hblock[i] += gaussianPulse(t[i] - center, 0.0, 0.06, 0.15);
    }
  }
  for (let i = 0; i < n; i++) {
    hblock[i] += 0.04 * Math.sin(2 * Math.PI * 0.8 * t[i]) + 0.03 * Math.sin(2 * Math.PI * 1.5 * t[i]);
  }

  const voices = [normal, afib, vtach, hblock];
  const mix = normal.map((_, i) => normal[i] + afib[i] * 0.5 + vtach[i] * 0.3 + hblock[i] * 0.3);
  return { time: t, voices, mix };
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

function pseudoFft(freqs, bands, gains, isEcg = false) {
  const out = freqs.map(() => 0.02);
  // Center frequency for background bump — 600 Hz for audio, 15 Hz for ECG
  const bumpCenter = isEcg ? 15 : 600;
  const bumpWidth = isEcg ? 20 : 900;
  for (let i = 0; i < freqs.length; i += 1) {
    const f = freqs[i];
    let mag = 0.02;
    for (let b = 0; b < bands.length; b += 1) {
      const [lo, hi] = bands[b];
      if (f >= lo && f <= hi) mag += 0.35 * (Number(gains[b]) || 1);
    }
    mag += 0.15 * Math.exp(-Math.pow((f - bumpCenter) / bumpWidth, 2));
    out[i] = mag;
  }
  return out;
}

/** Cooley-Tukey radix-2 in-place FFT (DIT). re/im are Float32Arrays of size 2^k. */
function radix2FFT(re, im) {
  const n = re.length;
  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let uRe = 1, uIm = 0;
      for (let k = 0; k < half; k++) {
        const tRe = uRe * re[i + k + half] - uIm * im[i + k + half];
        const tIm = uRe * im[i + k + half] + uIm * re[i + k + half];
        re[i + k + half] = re[i + k] - tRe;
        im[i + k + half] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const newU = uRe * wRe - uIm * wIm;
        uIm = uRe * wIm + uIm * wRe;
        uRe = newU;
      }
    }
  }
}

/**
 * Real STFT spectrogram.
 * Returns { data: [freqBin][timeFrame] (values 0-1), freqs, times }
 */
function computeSpectrogram(signal, fs, winSize, hopSize, maxDisplayFreq) {
  // Pre-compute Hann window
  const hann = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (winSize - 1)));
  }

  const freqRes = fs / winSize;
  const maxBin = Math.min(Math.floor(maxDisplayFreq / freqRes) + 1, (winSize >> 1) + 1);

  const re = new Float32Array(winSize);
  const im = new Float32Array(winSize);
  const allMags = [];

  for (let start = 0; start + winSize <= signal.length; start += hopSize) {
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < winSize; i++) re[i] = (signal[start + i] || 0) * hann[i];
    radix2FFT(re, im);
    const mag = new Float32Array(maxBin);
    for (let i = 0; i < maxBin; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    allMags.push(mag);
  }

  if (allMags.length === 0) return { data: [], freqs: [], times: [] };

  // Global normalize
  let maxVal = 1e-10;
  for (const f of allMags) for (const v of f) if (v > maxVal) maxVal = v;

  // Build [freqBin][timeFrame] with log-power scaling for better contrast
  const data = Array.from({ length: maxBin }, (_, r) =>
    allMags.map((f) => {
      const lin = f[r] / maxVal;
      return Math.sqrt(lin); // sqrt for better dynamic range
    })
  );

  const freqs = Array.from({ length: maxBin }, (_, i) => i * freqRes);
  const times = Array.from({ length: allMags.length }, (_, i) => i * hopSize / fs);
  return { data, freqs, times };
}

/**
 * Haar DWT energy per level.
 * Returns { in: number[], out: number[] } — RMS energy at each detail level.
 */
function computeWaveletEnergy(inputSignal, outputSignal, levels) {
  function haarDWT(sig) {
    const n = sig.length;
    const approx = new Float32Array(Math.floor(n / 2));
    const detail = new Float32Array(Math.floor(n / 2));
    const inv = 1 / Math.SQRT2;
    for (let i = 0; i < approx.length; i++) {
      approx[i] = (sig[2 * i] + sig[2 * i + 1]) * inv;
      detail[i] = (sig[2 * i] - sig[2 * i + 1]) * inv;
    }
    return { approx, detail };
  }

  function levelEnergy(sig) {
    let e = 0;
    for (const v of sig) e += v * v;
    return Math.sqrt(e / sig.length) || 0;
  }

  function extractLevels(signal, nLevels) {
    // Pad to nearest power of 2
    const targetLen = Math.pow(2, Math.ceil(Math.log2(signal.length)));
    let cur = new Float32Array(targetLen);
    for (let i = 0; i < signal.length; i++) cur[i] = signal[i];

    const energies = [];
    for (let l = 0; l < nLevels; l++) {
      if (cur.length < 2) break;
      const { approx, detail } = haarDWT(cur);
      energies.push(levelEnergy(detail));
      cur = approx;
    }
    return energies;
  }

  return {
    in:  extractLevels(inputSignal,  levels),
    out: extractLevels(outputSignal, levels),
  };
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
  const isEcg = modeId === 'ecg';
  const fs = isEcg ? 500 : 44100;
  const seconds = isEcg ? 6 : 4;

  const audioInput = useMemo(() => makeSyntheticMix(44100, 4), []);
  const ecgInput = useMemo(() => makeEcgMix(500, 6), []);
  const input = isEcg ? ecgInput : audioInput;

  const [data, setData] = useState(null);

  useEffect(() => {
    const gains = modeId === 'generic'
      ? (genericBands?.length ? genericBands.map((b) => Number(b.gain) || 1) : freqSliders)
      : freqSliders;

    let outputSignal;
    let bands;
    let fftMaxFreq;

    if (isEcg) {
      outputSignal = applyVoiceGains(input.voices, gains);
      bands = [[0.05, 100], [5, 50], [3, 40], [0.5, 5]];
      fftMaxFreq = 100;
    } else {
      // All non-ECG modes: voices map to sliders, apply gains individually
      outputSignal = applyVoiceGains(input.voices, gains);
      bands = modeId === 'generic'
        ? (genericBands?.length
          ? genericBands.map((b) => [Number(b.low) || 0, Number(b.high) || 0])
          : [[80, 180], [180, 300], [300, 3000], [3000, 8000]])
        : [[80, 180], [180, 300], [300, 3000], [3000, 8000]];
      fftMaxFreq = 8000;
    }

    const fftFreq = linspace(512, 0, fftMaxFreq);
    const fftIn = pseudoFft(fftFreq, bands, [1, 1, 1, 1], isEcg);
    const fftOut = pseudoFft(fftFreq, bands, gains, isEcg);

    // Real STFT spectrograms
    let winSize, hopSize;
    if (isEcg) {
      winSize = 256; hopSize = 32;  // 1.95 Hz/bin, ~85 frames for 6s ECG at 500 Hz
    } else {
      winSize = 1024; hopSize = 1024; // 43 Hz/bin, ~172 frames for 4s audio at 44100 Hz
    }
    const specIn = computeSpectrogram(input.mix, fs, winSize, hopSize, fftMaxFreq);
    const specOut = computeSpectrogram(outputSignal, fs, winSize, hopSize, fftMaxFreq);

    const w = computeWaveletEnergy(input.mix, outputSignal, 6);

    const id = window.setTimeout(() => {
      setData({
        time: input.time,
        input_signal: input.mix,
        output_signal: outputSignal,
        fft: { freq: fftFreq, in: fftIn, out: fftOut },
        spectrogram: { t: specIn.times, f: specIn.freqs, in: specIn.data, out: specOut.data },
        wavelet: { levels: Array.from({ length: 6 }, (_, i) => i), in: w.in, out: w.out }
      });
    }, 120);

    return () => window.clearTimeout(id);
  }, [freqSliders, waveletSliders, modeId, genericBands, waveletType, input, isEcg, fs, seconds]);

  return data;
}

