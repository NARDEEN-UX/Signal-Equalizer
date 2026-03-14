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
  instrumentTypes: ['Bass', 'Piano', 'Vocals', 'Violin', 'Drums', 'Guitar', 'Flute', 'Trumpet'],
  freqBands: [
    { min: 20, max: 250, label: 'Bass' },
    { min: 27, max: 4186, label: 'Piano' },
    { min: 80, max: 8000, label: 'Vocals' },
    { min: 196, max: 3520, label: 'Violin' }
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
