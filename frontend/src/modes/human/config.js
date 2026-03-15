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
  sliderLabels: ['Young', 'Old', 'Male', 'Female'],
  voiceTypes: ['Young', 'Old', 'Male', 'Female', 'Arabic', 'English', 'Spanish', 'French', 'German', 'Chinese', 'Child', 'Adult'],
  freqBands: [
    { min: 200, max: 15000, label: 'Young' },
    { min: 80, max: 4000, label: 'Old' },
    { min: 85, max: 255, label: 'Male' },
    { min: 165, max: 255, label: 'Female' }
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
