/**
 * Human Mode Configuration
 * Mode-specific settings for Human Voices separation
 * 
 * Team member: @human-mode-dev
 * Backend endpoint: /api/modes/human
 */

export const HUMAN_MODE_CONFIG = {
  id: 'human',
  name: 'Human Voices',
  sliderLabels: ['Male', 'Female', 'Old', 'Child'],
  voiceTypes: ['Male', 'Female', 'Old', 'Child'],
  freqBands: [
    { min: 85, max: 180, label: 'Male' },
    { min: 165, max: 300, label: 'Female' },
    { min: 80, max: 150, label: 'Old' },
    { min: 220, max: 420, label: 'Child' }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100,
  // Backend service will be imported here
};

/**
 * Human Mode API Service
 * Add your Human mode specific API calls in humanService.js
 */
