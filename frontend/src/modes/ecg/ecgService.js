/**
 * ECG Mode Backend Service
 * Connects to /api/modes/ecg endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const ecgModeService = {
  /**
   * Process ECG signal with arrhythmia component equalization
   * @param {number[]} signal - ECG signal samples
   * @param {number[]} gains - Gain per component [Normal, AFib, VTach, HeartBlock]
   * @param {string[]} componentNames - Component names matching backend COMPONENT_RANGES
   * @param {number} sampleRate - ECG sample rate (default 500)
   * @returns {Promise<Object>} - { status, output_signal, output_fft, output_spectrogram, processing_time }
   */
  processSignal: async (signal, gains, componentNames, sampleRate = 500) => {
    const response = await fetch(`${API_BASE_URL}/api/modes/ecg/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signal,
        sample_rate: sampleRate,
        gains,
        component_names: componentNames,
        wavelet: 'db4',
        wavelet_level: 6
      })
    });
    if (!response.ok) throw new Error(`ECG processing failed: ${response.statusText}`);
    return response.json();
  },

  /** Get default ECG settings from backend */
  getDefaultSettings: async () => {
    const response = await fetch(`${API_BASE_URL}/api/modes/ecg/settings/default`);
    if (!response.ok) throw new Error('Failed to load ECG defaults');
    return response.json();
  },

  /** Get available ECG component names from backend */
  getComponents: async () => {
    const response = await fetch(`${API_BASE_URL}/api/modes/ecg/components`);
    if (!response.ok) throw new Error('Failed to load ECG components');
    return response.json();
  }
};
