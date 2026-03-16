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
    { min: 500, max: 1400, label: 'Adult Male' },
    { min: 1500, max: 4000, label: 'Adult Female' },
    { min: 900, max: 1500, label: 'Child' },
    { min: 50, max: 350, label: 'Elderly' }
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
