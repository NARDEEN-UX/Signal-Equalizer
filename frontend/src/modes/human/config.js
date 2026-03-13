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
  sliderLabels: ['Voice 1', 'Voice 2', 'Voice 3', 'Voice 4'],
  freqBands: [
    { min: 80, max: 180, label: 'Voice 1' },
    { min: 180, max: 300, label: 'Voice 2' },
    { min: 300, max: 3000, label: 'Voice 3' },
    { min: 3000, max: 8000, label: 'Voice 4' }
  ],
  wavelet: 'haar',
  waveletLevels: 5,
  sampleRate: 44100,
  // Backend service will be imported here
};

/**
 * Human Mode API Service
 * Add your Human mode specific API calls in humanService.js
 */
