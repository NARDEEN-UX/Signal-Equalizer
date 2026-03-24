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
  sliderLabels: ['Normal', 'AFib', 'VTach', 'HeartBlock'],
  componentTypes: ['Normal', 'Atrial Fibrillation', 'Ventricular Tachycardia', 'Heart Block', 'Premature Beats', 'Bradycardia', 'Tachycardia'],
  freqBands: [
    { min: 2.2, max: 15.5, label: 'Normal' },
    { min: 0.0, max: 179.4, label: 'AFib' },
    { min: 2.2, max: 3.3, label: 'VTach' },
    { min: 2.2, max: 31.0, label: 'HeartBlock' }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 500, // Typical ECG sample rate
  // Backend service will be imported here
};

/**
 * ECG Mode API Service
 * Add your ECG mode specific API calls in ecgService.js
 */
