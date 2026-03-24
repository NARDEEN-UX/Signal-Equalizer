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
      in: Array.isArray(inSpec?.magnitude) ? inSpec.magnitude : (Array.isArray(apiData?.spectrogram?.in) ? apiData.spectrogram.in : []),
      out: Array.isArray(outSpec?.magnitude) ? outSpec.magnitude : (Array.isArray(apiData?.spectrogram?.out) ? apiData.spectrogram.out : [])
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
  waveletType = 'db8',
  waveletLevel = 6,
  processingMethod = 'fft',
  waveletSliders = null
}) => {
  const PROCESS_DEBOUNCE_MS = 40;
  const [result, setResult] = useState({ modeId: null, signalToken: null, data: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Serialize bands to a stable string so useEffect doesn't fire on
  // every render due to a new array/object reference.
  const bandsKey = JSON.stringify(
    (Array.isArray(genericBands) ? genericBands : []).map(b => ({
      id: b?.id,
      name: b?.name,
      low: b?.low,
      high: b?.high,
      ranges: Array.isArray(b?.ranges) ? b.ranges : null,
      gain: b?.gain
    }))
  );

  const waveletSlidersKey = JSON.stringify(waveletSliders);
  const signalToken = Array.isArray(signalData) && signalData.length > 0
    ? `${signalData.length}:${toNum(signalData[0], 0)}:${toNum(signalData[signalData.length - 1], 0)}`
    : 'none';

  useEffect(() => {
    if (!Array.isArray(signalData) || signalData.length === 0) {
      setResult((prev) => ({ ...prev, modeId, signalToken: 'none', data: null }));
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const requestConfig = { signal: controller.signal };

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const bands = Array.isArray(genericBands) ? genericBands : [];
        const gains = bands.map((b) => toNum(b?.gain, 1));
        const names = bands.map((b, i) => String(b?.name || `Band ${i + 1}`));

        const method = modeId === 'generic' ? 'fft' : processingMethod;

        let response;
        if (modeId === 'music') {
          response = await processMusicMode(
            signalData,
            gains,
            names,
            sampleRate,
            method,
            waveletType,
            waveletLevel,
            waveletSliders,
            bands,
            requestConfig
          );
        } else if (modeId === 'animal') {
          response = await processAnimalsMode(signalData, gains, names, sampleRate, method, waveletType, waveletLevel, waveletSliders, requestConfig);
        } else if (modeId === 'human') {
          response = await processHumansMode(
            signalData,
            gains,
            names,
            sampleRate,
            method,
            waveletType,
            waveletLevel,
            waveletSliders,
            bands,
            requestConfig
          );
        } else if (modeId === 'ecg') {
          response = await processECGMode(signalData, gains, names, sampleRate, method, waveletType, waveletLevel, waveletSliders, requestConfig);
        } else {
          response = await processGenericMode(signalData, bands, sampleRate, requestConfig);
        }

        if (!cancelled) {
          setResult({
            modeId,
            signalToken,
            data: normalizeResponse(response?.data || {}, signalData, sampleRate)
          });
        }
      } catch (err) {
        const aborted = err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError';
        if (!cancelled && !aborted) {
          setError(err?.message || 'Backend processing failed');
          if (!useFallback) {
            setResult({ modeId, signalToken, data: null });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(run, PROCESS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeId, bandsKey, sampleRate, signalData, useFallback, waveletType, waveletLevel, processingMethod, waveletSlidersKey]);

  const data = (result.modeId === modeId && result.signalToken === signalToken) ? result.data : null;

  return { data, loading, error };
};

export default useBackendProcessing;
