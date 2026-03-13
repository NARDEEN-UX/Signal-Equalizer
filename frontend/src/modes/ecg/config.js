/**
 * ECG Mode Configuration
 * Mode-specific settings for ECG Abnormality Detection
 * 
 * Team member: @ecg-mode-dev
 * Backend endpoint: /api/modes/ecg
 */

export const ECG_MODE_CONFIG = {
  id: 'ecg',
  name: 'ECG Abnormalities',
  sliderLabels: ['Normal', 'Arrhythmia 1', 'Arrhythmia 2', 'Arrhythmia 3'],
  freqBands: [
    { min: 0.5, max: 5, label: 'Normal' },
    { min: 5, max: 15, label: 'Arrhythmia 1' },
    { min: 15, max: 30, label: 'Arrhythmia 2' },
    { min: 30, max: 45, label: 'Arrhythmia 3' }
  ],
  wavelet: 'db4',
  waveletLevels: 5,
  sampleRate: 250, // Typical ECG sample rate
  // Backend service will be imported here
};

/**
 * ECG Mode API Service
 * Add your ECG mode specific API calls in ecgService.js
 */
