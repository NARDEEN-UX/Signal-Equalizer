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
  sliderLabels: ['Normal', 'Atrial Fibrillation', 'Ventricular Tachycardia', 'Heart Block'],
  componentTypes: ['Normal', 'Atrial Fibrillation', 'Ventricular Tachycardia', 'Heart Block', 'Premature Beats', 'Bradycardia', 'Tachycardia'],
  freqBands: [
    { min: 0.05, max: 100, label: 'Normal' },
    { min: 5, max: 50, label: 'Atrial Fibrillation' },
    { min: 3, max: 40, label: 'Ventricular Tachycardia' },
    { min: 0.5, max: 5, label: 'Heart Block' }
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
