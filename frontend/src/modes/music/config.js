/**
 * Music Mode Configuration
 * Mode-specific settings for Musical Instruments separation
 * 
 * Team member: @music-mode-dev
 * Backend endpoint: /api/modes/music
 */

export const MUSIC_MODE_CONFIG = {
  id: 'music',
  name: 'Musical Instruments',
  sliderLabels: ['Bass', 'Piano', 'Vocals', 'Violin'],
  freqBands: [
    { min: 60, max: 250, label: 'Bass' },
    { min: 250, max: 2000, label: 'Piano' },
    { min: 2000, max: 4000, label: 'Vocals' },
    { min: 4000, max: 12000, label: 'Violin' }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100,
  // Backend service will be imported here
};

/**
 * Music Mode API Service
 * Add your Music mode specific API calls in musicService.js
 */
