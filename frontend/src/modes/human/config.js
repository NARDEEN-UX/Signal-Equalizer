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
  sliderLabels: ['Adult Male', 'Adult Female', 'Child', 'Elderly'],
  voiceTypes: ['Adult Male', 'Adult Female', 'Child', 'Elderly'],
  freqBands: [
    { min: 700, max: 1200, label: 'Adult Male' },
    { min: 1500, max: 2300, label: 'Adult Female' },
    { min: 1200, max: 1500, label: 'Child' },
    { min: 350, max: 700, label: 'Elderly' }
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
