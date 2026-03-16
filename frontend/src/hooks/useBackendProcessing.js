import { useEffect, useState } from 'react';
import {
  processGenericMode,
  processMusicMode,
  processAnimalsMode,
  processHumansMode,
  processECGMode
} from '../api';

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const makeTime = (length, sampleRate) => {
  const sr = Math.max(1, toNum(sampleRate, 44100));
  return Array.from({ length }, (_, i) => i / sr);
};

const MUSIC_LEVEL_MAP = {
  bass: ['L5', 'L6'],
  piano: ['L3', 'L4'],
  vocals: ['L3', 'L4', 'L5'],
  violin: ['L3', 'L4']
};

const buildMusicWaveletGains = (bands) => {
  const gains = { L1: 1, L2: 1, L3: 1, L4: 1, L5: 1, L6: 1 };
  if (!Array.isArray(bands)) return gains;

  for (let i = 0; i < bands.length; i += 1) {
    const name = String(bands[i]?.name || '').trim().toLowerCase();
    if (name === 'others') continue;
    const mapped = MUSIC_LEVEL_MAP[name] || [];
    const g = Math.max(0, Math.min(2, toNum(bands[i]?.gain, 1)));
    for (let j = 0; j < mapped.length; j += 1) {
      const level = mapped[j];
      gains[level] *= g;
    }
  }

  return gains;
};

const normalizeResponse = (apiData, inputSignal, sampleRate) => {
  const outputSignal = Array.isArray(apiData?.output_signal) ? apiData.output_signal : inputSignal;

  const inFft = apiData?.input_fft || {};
  const outFft = apiData?.output_fft || {};

  const inSpec = apiData?.input_spectrogram || {};
  const outSpec = apiData?.output_spectrogram || {};

  const inputCoeffs = Array.isArray(apiData?.input_coeffs) ? apiData.input_coeffs : [];
  const outputCoeffs = Array.isArray(apiData?.output_coeffs) ? apiData.output_coeffs : [];
  const levelCount = Math.min(inputCoeffs.length || 0, outputCoeffs.length || 0);

  return {
    time: makeTime(outputSignal.length, sampleRate),
    input_signal: inputSignal,
    output_signal: outputSignal,
    fft: {
      freq: Array.isArray(outFft?.frequencies) ? outFft.frequencies : [],
      in: Array.isArray(inFft?.magnitudes) ? inFft.magnitudes : [],
      out: Array.isArray(outFft?.magnitudes) ? outFft.magnitudes : []
    },
    spectrogram: {
      t: Array.isArray(outSpec?.times) ? outSpec.times : [],
      f: Array.isArray(outSpec?.frequencies) ? outSpec.frequencies : [],
      in: Array.isArray(inSpec?.magnitude) ? inSpec.magnitude : [],
      out: Array.isArray(outSpec?.magnitude) ? outSpec.magnitude : []
    },
    wavelet: {
      levels: Array.from({ length: levelCount }, (_, i) => `L${i + 1}`),
      input_coeffs: inputCoeffs,
      output_coeffs: outputCoeffs
    }
  };
};

export const useBackendProcessing = ({
  modeId,
  genericBands,
  sampleRate,
  signalData,
  useFallback = true,
  waveletType = 'db8'
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!Array.isArray(signalData) || signalData.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const bands = Array.isArray(genericBands) ? genericBands : [];
        const gains = bands.map((b) => toNum(b?.gain, 1));
        const names = bands.map((b, i) => String(b?.name || `Band ${i + 1}`));

        let response;
        if (modeId === 'music') {
          const waveletGains = buildMusicWaveletGains(bands);
          console.log('[wavelet] sending level gains', waveletGains);
          response = await processMusicMode(signalData, gains, names, sampleRate, waveletType, 6, waveletGains);
        } else if (modeId === 'animal') {
          response = await processAnimalsMode(signalData, gains, names, sampleRate);
        } else if (modeId === 'human') {
          response = await processHumansMode(signalData, gains, names, sampleRate);
        } else if (modeId === 'ecg') {
          response = await processECGMode(signalData, gains, names, sampleRate);
        } else {
          response = await processGenericMode(signalData, bands, sampleRate);
        }

        if (!cancelled) {
          const out = Array.isArray(response?.data?.output_signal) ? response.data.output_signal : [];
          if (out.length) {
            let minV = Infinity;
            let maxV = -Infinity;
            for (let i = 0; i < out.length; i += 1) {
              const v = Number(out[i]);
              if (Number.isFinite(v)) {
                if (v < minV) minV = v;
                if (v > maxV) maxV = v;
              }
            }
            console.log('[wavelet] received output signal range', { min: minV, max: maxV });
          }
          setData(normalizeResponse(response?.data || {}, signalData, sampleRate));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Backend processing failed');
          if (!useFallback) setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [modeId, genericBands, sampleRate, signalData, useFallback, waveletType]);

  return { data, loading, error };
};

export default useBackendProcessing;
