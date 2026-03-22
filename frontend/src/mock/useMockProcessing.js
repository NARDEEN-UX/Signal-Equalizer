import { useEffect, useMemo, useState } from 'react';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function toNumberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function frequencyToWindow(freq, fs) {
  const safeFreq = Math.max(1, Number(freq) || 1);
  return clamp(Math.round(fs / (2 * Math.PI * safeFreq)), 1, 600);
}

function buildEqualizedSignal(signal, bands, gains, fs = 44100, maxHz = 20000) {
  if (!signal?.length) return [];

  const activeBands = (bands?.length
    ? bands
    : [[80, 180], [180, 300], [300, 3000], [3000, 8000]]
  ).map(([lo, hi]) => {
    const low = clamp(toNumberOr(lo, 0), 0, maxHz - 1);
    const high = clamp(Math.max(toNumberOr(hi, low + 1), low + 1), low + 1, maxHz);
    return [low, high];
  });

  const g = activeBands.map((_, i) => clamp(Number(gains[i] ?? 1), 0, 2));
  const smoothCache = new Map();

  const getSmoothed = (window) => {
    if (!smoothCache.has(window)) {
      smoothCache.set(window, movingAverage(signal, window));
    }
    return smoothCache.get(window);
  };

  const n = signal.length;
  const out = new Array(n).fill(0);

  for (let b = 0; b < activeBands.length; b += 1) {
    const [lowHz, highHz] = activeBands[b];
    const gain = g[b] ?? 1;

    const lowSmooth = lowHz <= 0 ? null : getSmoothed(frequencyToWindow(lowHz, fs));
    const highSmooth = highHz >= maxHz ? null : getSmoothed(frequencyToWindow(highHz, fs));

    for (let i = 0; i < n; i += 1) {
      const sample = signal[i] || 0;
      let bandComponent;

      if (!lowSmooth && highSmooth) {
        bandComponent = highSmooth[i];
      } else if (lowSmooth && !highSmooth) {
        bandComponent = sample - lowSmooth[i];
      } else if (lowSmooth && highSmooth) {
        bandComponent = highSmooth[i] - lowSmooth[i];
      } else {
        bandComponent = sample;
      }

      out[i] += gain * bandComponent;
    }
  }

  // Keep absolute attenuation/amplification so gain=0 is visibly weaker than gain=1.
  return out;
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
  const overlapGainAtFreq = (f) => {
    let matched = false;
    let matchedSum = 0;
    let matchedCount = 0;
    let activeSum = 0;
    let activeCount = 0;

    for (let b = 0; b < bands.length; b += 1) {
      const [lo, hi] = bands[b];
      if (f >= lo && f <= hi) {
        matched = true;
        const g = clamp(toNumberOr(gains[b], 1), 0, 2);
        matchedSum += g;
        matchedCount += 1;
        if (g > 1e-8) {
          activeSum += g;
          activeCount += 1;
        }
      }
    }

    if (activeCount > 0) return matchedSum / Math.max(1, matchedCount);
    return matched ? 0 : 1;
  };

  return normSpec.map((row, fIdx) => {
    const f = freqs[fIdx] || 0;
    const g = clamp(overlapGainAtFreq(f), 0, 4);
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
      if (f >= lo && f <= hi) mag += 0.35 * toNumberOr(gains[b], 1);
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

  return { freq: freqs, mag: mags, in: mags, out: mags };
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

  return { t: times, f: freqs, mag: mags, in: mags, out: mags };
}

const MUSIC_LEVEL_MAP = {
  bass: [5, 6],
  piano: [3, 4],
  vocals: [3, 4, 5],
  violin: [3, 4]
};

function makeLevelLabels(levels) {
  return Array.from({ length: levels }, (_, i) => `L${i + 1}`);
}

function downsample(arr, maxPoints = 320) {
  if (!Array.isArray(arr) || arr.length <= maxPoints) return arr || [];
  const step = Math.max(1, Math.floor(arr.length / maxPoints));
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  return out;
}

function computePseudoDetailCoeffs(signal, levels = 6) {
  if (!Array.isArray(signal) || !signal.length) return Array.from({ length: levels }, () => []);
  const coeffs = [];
  for (let lv = 1; lv <= levels; lv += 1) {
    const step = 2 ** lv;
    const half = Math.max(1, Math.floor(step / 2));
    const detail = [];
    for (let i = 0; i < signal.length; i += step) {
      const a = Number(signal[i] || 0);
      const b = Number(signal[Math.min(signal.length - 1, i + half)] || 0);
      detail.push(a - b);
    }
    coeffs.push(downsample(detail));
  }
  return coeffs;
}

function computeMusicLevelGains(levels, bands, gains) {
  const levelGains = Array.from({ length: levels }, () => 1);
  for (let i = 0; i < (bands?.length || 0); i += 1) {
    const name = String(bands[i]?.name || '').trim().toLowerCase();
    if (name === 'others') continue; // Keep neutral by spec.
    const mapped = MUSIC_LEVEL_MAP[name] || [];
    const g = clamp(toNumberOr(gains[i], 1), 0, 2);
    for (let j = 0; j < mapped.length; j += 1) {
      const lv = mapped[j];
      if (lv >= 1 && lv <= levels) {
        levelGains[lv - 1] *= g;
      }
    }
  }
  return levelGains;
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

  // Use uploaded signal if provided, otherwise return null to show empty graphs
  const input = useMemo(() => {
    if (!inputSignal || inputSignal.length === 0) {
      return null;
    }
    // Use the uploaded signal
    const time = linspace(inputSignal.length, 0, seconds);
    return {
      time,
      voices: [inputSignal, [], [], []],  // Put uploaded signal as first "voice"
      mix: inputSignal
    };
  }, [inputSignal, fs, seconds]);

  // Heavy transforms (FFT + spectrogram) depend only on the signal itself,
  // not on slider changes. Precompute them once per uploaded/synthetic signal.
  const baseFft = useMemo(
    () => input?.mix ? computeRealFft(input.mix, fs) : null,
    [input?.mix, fs]
  );

  const baseSpec = useMemo(
    () => input?.mix ? computeSpectrogram(input.mix, fs) : null,
    [input?.mix, fs]
  );
  const [data, setData] = useState(null);

  // Pre-compute wavelet coefficients only when input signal changes (expensive)
  const inputCoeffsMemo = useMemo(() => {
    if (!input?.mix) return null;
    return computePseudoDetailCoeffs(input.mix, 6);
  }, [input?.mix]);

  // Pre-compute and normalize spectrogram only when input signal changes (expensive)
  const normalizedSpecMemo = useMemo(() => {
    if (!input?.mix || !baseSpec?.f?.length || !baseSpec?.t?.length) return null;
    const flat = baseSpec.mag.flat();
    const maxMag = flat.reduce((m, v) => (v > m ? v : m), 1e-6);
    return baseSpec.mag.map((row) => row.map((v) => v / maxMag));
  }, [input?.mix, baseSpec]);

  // Pre-compute FFT normalization only when input signal changes (expensive)
  const normalizedFFTMemo = useMemo(() => {
    if (!baseFft?.mag?.length) return null;
    const maxMag = baseFft.mag.reduce((m, v) => (v > m ? v : m), 1e-6);
    return baseFft.mag.map((v) => v / maxMag);
  }, [baseFft?.mag]);

  // Serialize slider/band arrays to stable strings so effect doesn't fire on every render
  const freqKey = JSON.stringify(freqSliders);
  const waveletKey = JSON.stringify(waveletSliders);
  const bandsKey = JSON.stringify(
    (genericBands || []).map(b => ({
      id: b?.id, name: b?.name, low: b?.low, high: b?.high, gain: b?.gain
    }))
  );

  useEffect(() => {
    if (!input) {
      setData(null);
      return;
    }
    // Use the per-mode band configuration passed from App for *all* modes.
    const bands = (genericBands?.length
      ? genericBands.map((b) => [Number(b.low) || 0, Number(b.high) || 0])
      : [[80, 180], [180, 300], [300, 3000], [3000, 8000]]);

    const gains = (genericBands?.length
      ? genericBands.map((b, i) => toNumberOr(b.gain ?? freqSliders[i], 1))
      : freqSliders);

    const clampedGains = gains.map((g) => clamp(toNumberOr(g, 1), 0, 2));
    const isUnityGains = clampedGains.every((g) => Math.abs(g - 1) < 1e-9);

    // Build output signal (fast when isUnityGains, or use cached signal)
    const outputSignal =
      isUnityGains
        ? [...input.mix]
        : modeId === 'human'
        ? applyVoiceGains(input.voices, clampedGains)
        : buildEqualizedSignal(input.mix, bands, clampedGains, fs);

    // Fast FFT gain application using pre-computed normalized values
    let fftFreq;
    let fftIn;
    let fftOut;
    if (input.mix && input.mix.length > 0 && baseFft?.freq?.length && normalizedFFTMemo) {
      fftFreq = baseFft.freq;
      fftIn = normalizedFFTMemo;
      // Fast: just multiply by per-frequency gains
      fftOut = fftIn.map((mag, i) => {
        const f = fftFreq[i];
        let matched = false;
        let matchedSum = 0;
        let matchedCount = 0;
        let activeSum = 0;
        let activeCount = 0;

        for (let b = 0; b < bands.length; b += 1) {
          const [lo, hi] = bands[b];
          if (f >= lo && f <= hi) {
            matched = true;
            const gain = toNumberOr(clampedGains[b], 1);
            matchedSum += gain;
            matchedCount += 1;
            if (gain > 1e-8) {
              activeSum += gain;
              activeCount += 1;
            }
          }
        }

        const overlapGain = activeCount > 0
          ? (matchedSum / Math.max(1, matchedCount))
          : (matched ? 0 : 1);
        return mag * clamp(overlapGain, 0, 4);
      });
    } else {
      // Fallback to pseudo-FFT
      fftFreq = linspace(512, 0, 8000);
      fftIn = pseudoFft(fftFreq, bands, [1, 1, 1, 1]);
      fftOut = pseudoFft(fftFreq, bands, clampedGains);
    }

    // Fast spectrogram gain application using pre-computed normalized values
    let specT;
    let specF;
    let specIn;
    let specOut;
    if (input.mix && input.mix.length > 0 && baseSpec?.f?.length && baseSpec?.t?.length && normalizedSpecMemo) {
      specT = baseSpec.t;
      specF = baseSpec.f;
      specIn = normalizedSpecMemo;
      specOut = applyBandGainsToSpectrogram(specIn, specF, bands, clampedGains);
    } else {
      const energyScale = 0.55;
      specT = linspace(120, 0, seconds);
      specF = linspace(96, 0, 8000);
      specIn = pseudoSpectrogram(specF.length, specT.length, energyScale);
      const tone = 0.35 + 0.25 * clamp(toNumberOr(clampedGains[0], 1) / 2, 0, 1);
      specOut = pseudoSpectrogram(specF.length, specT.length, tone);
    }

    // Fast wavelet gain application using pre-computed coefficients
    const levelCount = 6;
    let outputCoeffs = inputCoeffsMemo ? inputCoeffsMemo.map((arr) => arr.map((v) => v)) : [];

    if (modeId === 'music' && inputCoeffsMemo) {
      const levelGains = computeMusicLevelGains(levelCount, genericBands || [], clampedGains);
      outputCoeffs = inputCoeffsMemo.map((arr, i) => arr.map((v) => v * levelGains[i]));
    }

    const explicitLevelGains = Array.from({ length: levelCount }, (_, i) => {
      const g = toNumberOr(waveletSliders?.[i], 1);
      return clamp(g, 0, 2);
    });
    outputCoeffs = outputCoeffs.map((arr, i) => arr.map((v) => v * explicitLevelGains[i]));

    setData({
      time: input.time,
      input_signal: input.mix,
      output_signal: outputSignal,
      fft: { freq: fftFreq, in: fftIn, out: fftOut },
      spectrogram: { t: specT, f: specF, in: specIn, out: specOut },
      wavelet: {
        wavelet: waveletType,
        levels: makeLevelLabels(levelCount),
        input_coeffs: inputCoeffsMemo || [],
        output_coeffs: outputCoeffs
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freqKey, waveletKey, modeId, bandsKey, waveletType, input, normalizedFFTMemo, normalizedSpecMemo, inputCoeffsMemo]);

  return data;
}

