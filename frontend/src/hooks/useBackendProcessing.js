import { useEffect, useState } from 'react';
import {
  processGenericMode,
  processMusicMode,
  processAnimalsMode,
  processHumansMode,
  processECGMode
} from '../api';

function computeRealFft(signal, fs = 44100, nFft = 1024) {
  if (!Array.isArray(signal) || signal.length === 0) {
    return { freq: [], mag: [] };
  }

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
      const v = Number(x[i]) || 0;
      re += v * Math.cos(angle);
      im += v * Math.sin(angle);
    }
    freqs.push((k * fs) / n);
    mags.push(Math.sqrt(re * re + im * im) / n);
  }

  return { freq: freqs, mag: mags };
}

function interpolateLinear(xArr, yArr, x) {
  if (!Array.isArray(xArr) || !Array.isArray(yArr) || xArr.length === 0 || yArr.length === 0) {
    return 0;
  }
  if (x <= xArr[0]) return Number(yArr[0]) || 0;
  const last = xArr.length - 1;
  if (x >= xArr[last]) return Number(yArr[last]) || 0;

  let idx = 0;
  while (idx + 1 < xArr.length && xArr[idx + 1] < x) idx += 1;
  const x0 = xArr[idx];
  const x1 = xArr[idx + 1];
  const y0 = Number(yArr[idx]) || 0;
  const y1 = Number(yArr[idx + 1]) || 0;
  const t = (x - x0) / Math.max(1e-12, x1 - x0);
  return y0 + t * (y1 - y0);
}

function computeLevelRms(signal, levels = 6) {
  if (!Array.isArray(signal) || signal.length === 0) {
    return Array.from({ length: levels }, () => 0);
  }

  const n = signal.length;
  const sliceSize = Math.max(1, Math.floor(n / levels));
  const out = [];

  for (let i = 0; i < levels; i += 1) {
    const start = i * sliceSize;
    const end = Math.min(n, start + sliceSize);
    let sumSq = 0;
    let count = 0;

    for (let j = start; j < end; j += 1) {
      const v = Number(signal[j]) || 0;
      sumSq += v * v;
      count += 1;
    }

    out.push(Math.sqrt(sumSq / Math.max(1, count)));
  }

  return out;
}

/**
 * Hook to process signals via backend APIs
 * Falls back to mock data if backend is unavailable
 */
export function useBackendProcessing({
  modeId,
  freqSliders,
  waveletSliders,
  genericBands,
  sampleRate = 44100,
  signalData,
  useFallback = true
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!signalData) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    const processSignal = async () => {
      try {
        const signal = signalData.mix || signalData;
        let result;

        if (modeId === 'generic') {
          const bands = genericBands || [];
          result = await processGenericMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            bands,
            sampleRate
          );
        } else if (modeId === 'music') {
          const names = ['Bass', 'Piano', 'Vocals', 'Violin'];
          result = await processMusicMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            freqSliders,
            names,
            sampleRate
          );
        } else if (modeId === 'animal') {
          const names = ['Cat', 'Dog', 'Bird', 'Elephant'];
          result = await processAnimalsMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            freqSliders,
            names,
            sampleRate
          );
        } else if (modeId === 'human') {
          const names = ['Young', 'Old', 'Male', 'Female'];
          result = await processHumansMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            freqSliders,
            names,
            sampleRate
          );
        } else if (modeId === 'ecg') {
          const names = ['Normal', 'Atrial Fibrillation', 'Ventricular Tachycardia', 'Heart Block'];
          result = await processECGMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            freqSliders,
            names,
            sampleRate
          );
        }

        if (result && result.data) {
          const respData = result.data;
          const inSpec = respData.input_spectrogram;
          const outSpec = respData.output_spectrogram;
          const inputSignal = signalData.mix || signal;
          const outputSignal = respData.output_signal;
          const effectiveSampleRate = Number(sampleRate) || 44100;

          const waveletInRaw = computeLevelRms(inputSignal, 6);
          const waveletOutRaw = computeLevelRms(outputSignal, 6);
          const waveletInMax = Math.max(...waveletInRaw, 1e-8);

          const waveletIn = waveletInRaw.map((v) => v / waveletInMax);
          const waveletOut = waveletOutRaw.map((v) => v / waveletInMax);

          const specTimes = outSpec?.times || inSpec?.times || [];
          const specFreqs = outSpec?.frequencies || inSpec?.frequencies || [];
          const specInMag = inSpec?.magnitude || [];
          const specOutMag = outSpec?.magnitude || [];

          let fftData = null;
          if (respData.output_fft?.frequencies?.length && respData.output_fft?.magnitudes?.length) {
            const outFreq = respData.output_fft.frequencies;
            const outMag = respData.output_fft.magnitudes.map((v) => Number(v) || 0);

            const inFft = computeRealFft(inputSignal, effectiveSampleRate, 2048);
            const inMagAligned = outFreq.map((f) => interpolateLinear(inFft.freq, inFft.mag, Number(f) || 0));

            const maxIn = Math.max(...inMagAligned, 1e-8);
            const maxOut = Math.max(...outMag, 1e-8);
            const sharedMax = Math.max(maxIn, maxOut, 1e-8);

            fftData = {
              freq: outFreq,
              in: inMagAligned.map((v) => v / sharedMax),
              out: outMag.map((v) => v / sharedMax)
            };
          }

          setData({
            time: signalData.time || Array.from({ length: respData.output_signal.length }, (_, i) => i / 44100),
            input_signal: inputSignal,
            output_signal: outputSignal,
            fft: fftData,
            spectrogram: outSpec || inSpec ? {
              t: specTimes,
              f: specFreqs,
              in: specInMag,
              out: specOutMag
            } : null,
            wavelet: {
              levels: Array.from({ length: 6 }, (_, i) => i),
              in: waveletIn,
              out: waveletOut
            }
          });
        }
        setLoading(false);
      } catch (err) {
        console.error('Backend processing error:', err);
        setError(err.message);
        setLoading(false);
        // Fallback handled by caller
      }
    };

    // Add a small delay to avoid too many requests
    const timeout = setTimeout(processSignal, 100);
    return () => clearTimeout(timeout);
  }, [modeId, freqSliders, waveletSliders, genericBands, sampleRate, signalData]);

  return { data, loading, error };
}
