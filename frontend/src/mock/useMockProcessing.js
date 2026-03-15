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

function movingAverage(signal, windowSize) {
  const n = signal.length;
  if (!n) return [];

  const w = Math.max(1, Math.floor(windowSize));
  const out = new Array(n).fill(0);
  const prefix = new Array(n + 1).fill(0);

  for (let i = 0; i < n; i += 1) {
    prefix[i + 1] = prefix[i] + (signal[i] || 0);
  }

  for (let i = 0; i < n; i += 1) {
    const start = Math.max(0, i - w);
    const end = Math.min(n - 1, i + w);
    const sum = prefix[end + 1] - prefix[start];
    out[i] = sum / (end - start + 1);
  }

  return out;
}

function rms(values) {
  if (!values?.length) return 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i] || 0;
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / values.length);
}

function buildEqualizedSignal(signal, gains) {
  if (!signal?.length) return [];

  const g = [0, 1, 2, 3].map((i) => clamp(Number(gains[i] ?? 1), 0, 2));
  const low = movingAverage(signal, 80);
  const midLowBase = movingAverage(signal, 24);
  const midHighBase = movingAverage(signal, 7);

  const n = signal.length;
  const out = new Array(n).fill(0);

  for (let i = 0; i < n; i += 1) {
    const lowBand = low[i];
    const midLow = midLowBase[i] - lowBand;
    const midHigh = midHighBase[i] - midLowBase[i];
    const highBand = signal[i] - midHighBase[i];
    out[i] = g[0] * lowBand + g[1] * midLow + g[2] * midHigh + g[3] * highBand;
  }

  const inRms = rms(signal) || 1;
  const outRms = rms(out) || 1;
  const energyMatch = inRms / outRms;
  return out.map((v) => v * energyMatch);
}

function computeLevelRms(signal, levels = 6) {
  if (!signal?.length) return Array.from({ length: levels }, () => 0);
  const n = signal.length;
  const sliceSize = Math.max(1, Math.floor(n / levels));
  const out = [];

  for (let i = 0; i < levels; i += 1) {
    const start = i * sliceSize;
    const end = Math.min(n, start + sliceSize);
    let sumSq = 0;
    let count = 0;

    for (let j = start; j < end; j += 1) {
      const v = signal[j] || 0;
      sumSq += v * v;
      count += 1;
    }

    out.push(Math.sqrt(sumSq / (count || 1)));
  }

  return out;
}

function applyBandGainsToSpectrogram(normSpec, freqs, bands, gains) {
  return normSpec.map((row, fIdx) => {
    const f = freqs[fIdx] || 0;
    let bandGain = 1;

    for (let b = 0; b < bands.length; b += 1) {
      const [lo, hi] = bands[b];
      if (f >= lo && f <= hi) {
        bandGain = gains[b] || 1;
        break;
      }
    }

    const g = clamp(bandGain, 0, 2);
    return row.map((v) => clamp(v * g, 0, 2));
  });
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

// Very small real-valued DFT for connecting uploaded signals
// to the FFT chart without requiring a heavy DSP stack.
function computeRealFft(signal, fs, nFft = 1024) {
  if (!signal || signal.length === 0) return { freq: [], mag: [] };
  const n = Math.min(signal.length, nFft);
  const x = signal.slice(0, n);
  const half = Math.floor(n / 2);
  const freqs = [];
  const mags = [];

  for (let k = 0; k <= half; k += 1) {
    let re = 0;
    let im = 0;
    const angleCoef = -2 * Math.PI * k / n;
    for (let i = 0; i < n; i += 1) {
      const angle = angleCoef * i;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const v = x[i] || 0;
      re += v * cosA;
      im += v * sinA;
    }
    const mag = Math.sqrt(re * re + im * im) / n;
    freqs.push((k * fs) / n);
    mags.push(mag);
  }

  return { freq: freqs, mag: mags };
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

// Tiny STFT-style spectrogram so uploaded signals have meaningful time–frequency content.
function computeSpectrogram(signal, fs, winSize = 256, hop = 128) {
  if (!signal || signal.length === 0) {
    return { t: [], f: [], mag: [] };
  }

  const n = signal.length;
  const frames = [];
  for (let start = 0; start + winSize <= n; start += hop) {
    const frame = signal.slice(start, start + winSize);
    // Hann window
    for (let i = 0; i < frame.length; i += 1) {
      frame[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));
    }
    frames.push(frame);
  }

  const half = Math.floor(winSize / 2);
  const freqs = [];
  for (let k = 0; k <= half; k += 1) {
    freqs.push((k * fs) / winSize);
  }

  const mags = Array.from({ length: freqs.length }, () =>
    new Array(frames.length).fill(0)
  );

  for (let frameIdx = 0; frameIdx < frames.length; frameIdx += 1) {
    const frame = frames[frameIdx];
    for (let k = 0; k <= half; k += 1) {
      let re = 0;
      let im = 0;
      const angleCoef = -2 * Math.PI * k / winSize;
      for (let i = 0; i < winSize; i += 1) {
        const angle = angleCoef * i;
        const v = frame[i] || 0;
        re += v * Math.cos(angle);
        im += v * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im) / winSize;
      mags[k][frameIdx] = mag;
    }
  }

  const times = [];
  for (let idx = 0; idx < frames.length; idx += 1) {
    times.push(((idx * hop) / fs));
  }

  return { t: times, f: freqs, mag: mags };
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
  waveletType = 'haar',
  inputSignal = null,
  sampleRate = 44100
}) {
  const fs = sampleRate;
  const seconds = inputSignal ? (inputSignal.length / fs) : 4;

  // Use uploaded signal if provided, otherwise generate synthetic
  const input = useMemo(() => {
    if (inputSignal && inputSignal.length > 0) {
      // Use the uploaded signal
      const time = linspace(inputSignal.length, 0, seconds);
      return {
        time,
        voices: [inputSignal, [], [], []],  // Put uploaded signal as first "voice"
        mix: inputSignal
      };
    } else {
      // Generate synthetic
      return makeSyntheticMix(fs, seconds);
    }
  }, [inputSignal, fs, seconds]);

  // Heavy transforms (FFT + spectrogram) depend only on the signal itself,
  // not on slider changes. Precompute them once per uploaded/synthetic signal.
  const baseFft = useMemo(
    () => computeRealFft(input.mix, fs),
    [input.mix, fs]
  );

  const baseSpec = useMemo(
    () => computeSpectrogram(input.mix, fs),
    [input.mix, fs]
  );
  const [data, setData] = useState(null);

  useEffect(() => {
    // Use the per-mode band configuration passed from App for *all* modes.
    // For generic mode this is the custom bands; for the others it is the
    // preset bands. Fall back to a sensible default if missing.
    const bands = (genericBands?.length
      ? genericBands.map((b) => [Number(b.low) || 0, Number(b.high) || 0])
      : [[80, 180], [180, 300], [300, 3000], [3000, 8000]]);

    const gains = (genericBands?.length
      ? genericBands.map((b, i) => Number(b.gain ?? freqSliders[i]) || 1)
      : freqSliders);

    const clampedGains = gains.map((g) => clamp(Number(g) || 1, 0, 2));

    // "Human": slider controls speakers directly.
    // Other modes: apply a lightweight 4-band decomposition so waveform shape changes,
    // not only overall amplitude (which can look unchanged after auto-scaling).
    const outputSignal =
      modeId === 'human'
        ? applyVoiceGains(input.voices, clampedGains)
        : buildEqualizedSignal(input.mix, clampedGains);

    // FFT: if we have an uploaded / processed signal, compute a tiny real FFT
    // so that the spectrum actually reflects the current signal.
    let fftFreq;
    let fftIn;
    let fftOut;
    if (input.mix && input.mix.length > 0 && baseFft.freq.length) {
      fftFreq = baseFft.freq;
      const baseMag = baseFft.mag;
      // Normalise a bit for stable plotting
      const maxMag = baseMag.reduce((m, v) => (v > m ? v : m), 1e-6);
      const normMag = baseMag.map((v) => v / maxMag);
      fftIn = normMag;
      // Apply per-band gains to build an approximate "output" spectrum
      const banded = [];
      for (let i = 0; i < fftFreq.length; i += 1) {
        const f = fftFreq[i];
        let g = 1;
        for (let b = 0; b < bands.length; b += 1) {
          const [lo, hi] = bands[b];
          if (f >= lo && f <= hi) {
            g = clampedGains[b] || 1;
            break;
          }
        }
        banded.push(normMag[i] * clamp(g, 0, 2));
      }
      const outMax = banded.reduce((m, v) => (v > m ? v : m), 1e-6);
      fftOut = banded.map((v) => v / outMax);
    } else {
      // Fallback to the previous pseudo-FFT if no signal is present
      fftFreq = linspace(512, 0, 8000);
      fftIn = pseudoFft(fftFreq, bands, [1, 1, 1, 1]);
      fftOut = pseudoFft(fftFreq, bands, clampedGains);
    }

    // Spectrogram: use precomputed input STFT and apply frequency-band gains.
    // Re-running STFT on every slider change causes visible UI latency.
    let specT;
    let specF;
    let specIn;
    let specOut;
    if (input.mix && input.mix.length > 0 && baseSpec.f.length && baseSpec.t.length) {
      specT = baseSpec.t;
      specF = baseSpec.f;
      const flat = baseSpec.mag.flat();
      const maxMag = flat.reduce((m, v) => (v > m ? v : m), 1e-6);
      const norm = baseSpec.mag.map((row) => row.map((v) => v / maxMag));
      specIn = norm;

      specOut = applyBandGainsToSpectrogram(norm, specF, bands, clampedGains);
    } else {
      const energyScale = 0.55;
      specT = linspace(120, 0, seconds);
      specF = linspace(96, 0, 8000);
      specIn = pseudoSpectrogram(specF.length, specT.length, energyScale);
      const tone =
        0.35 + 0.25 * clamp((Number(clampedGains[0]) || 1) / 2, 0, 1);
      specOut = pseudoSpectrogram(specF.length, specT.length, tone);
    }

    // Wavelet domain energy: derive a simple multi-band energy profile from the
    // current signal so that uploads affect the bars.
    let w;
    if (input.mix && input.mix.length > 0) {
      const levels = 6;
      const baseIn = computeLevelRms(input.mix, levels);
      const baseOut = computeLevelRms(outputSignal, levels);
      const maxIn = baseIn.reduce((m, v) => (v > m ? v : m), 1e-6);
      const maxOut = baseOut.reduce((m, v) => (v > m ? v : m), 1e-6);

      const normIn = baseIn.map((v) => v / maxIn);
      const normOut = baseOut.map((v, i) => {
        const waveletGain = Number(waveletSliders[i]) || 1;
        return (v / maxOut) * waveletGain;
      });

      w = { in: normIn, out: normOut };
    } else {
      w = pseudoWaveletEnergy(6, waveletSliders);
    }

    setData({
      time: input.time,
      input_signal: input.mix,
      output_signal: outputSignal,
      fft: { freq: fftFreq, in: fftIn, out: fftOut },
      spectrogram: { t: specT, f: specF, in: specIn, out: specOut },
      wavelet: { levels: Array.from({ length: 6 }, (_, i) => i), in: w.in, out: w.out }
    });
  }, [freqSliders, waveletSliders, modeId, genericBands, waveletType, input, baseFft, baseSpec]);

  return data;
}

