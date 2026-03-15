import { useEffect, useState } from 'react';
import {
  processGenericMode,
  processMusicMode,
  processAnimalsMode,
  processHumansMode,
  processECGMode
} from '../api';

/**
 * Hook to process signals via backend APIs
 * Falls back to mock data if backend is unavailable
 */
export function useBackendProcessing({
  modeId,
  freqSliders,
  waveletSliders,
  genericBands,
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
            bands.map(b => b.gain || 1)
          );
        } else if (modeId === 'music') {
          const names = ['Bass', 'Piano', 'Vocals', 'Violin'];
          result = await processMusicMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            freqSliders,
            names
          );
        } else if (modeId === 'animal') {
          const names = ['Cat', 'Dog', 'Bird', 'Elephant'];
          result = await processAnimalsMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            freqSliders,
            names
          );
        } else if (modeId === 'human') {
          const names = ['Young', 'Old', 'Male', 'Female'];
          result = await processHumansMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            freqSliders,
            names
          );
        } else if (modeId === 'ecg') {
          const names = ['Normal', 'Atrial Fibrillation', 'Ventricular Tachycardia', 'Heart Block'];
          result = await processECGMode(
            Array.isArray(signal) ? signal : Object.values(signal),
            freqSliders,
            names
          );
        }

        if (result && result.data) {
          const respData = result.data;
          setData({
            time: signalData.time || Array.from({ length: respData.output_signal.length }, (_, i) => i / 44100),
            input_signal: signalData.mix || signal,
            output_signal: respData.output_signal,
            fft: respData.output_fft ? {
              freq: respData.output_fft.frequencies,
              in: [1, 1, 1, 1],
              out: respData.output_fft.magnitudes
            } : null,
            spectrogram: respData.output_spectrogram ? {
              t: respData.output_spectrogram.times,
              f: respData.output_spectrogram.frequencies,
              in: [[0.5, 0.5], [0.5, 0.5]],
              out: respData.output_spectrogram.magnitude
            } : null,
            wavelet: { levels: Array.from({ length: 6 }, (_, i) => i), in: waveletSliders, out: waveletSliders }
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
  }, [modeId, freqSliders, waveletSliders, genericBands, signalData]);

  return { data, loading, error };
}
