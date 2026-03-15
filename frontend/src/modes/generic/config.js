/**
 * Generic Mode Configuration
 * Mode-specific settings for Generic/Custom frequency bands
 * 
 * Used when users want to create custom frequency band configurations
 * Backend endpoint: /api/modes/generic
 */

export const GENERIC_MODE_CONFIG = {
  id: 'generic',
  name: 'Generic Mode',
  sliderLabels: ['Band 1', 'Band 2', 'Band 3', 'Band 4'],
  freqBands: [], // Will be user-defined
  allowCustomBands: true,
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100,
  // Backend service will be imported here
};

/**
 * Generic Mode API Service
 * Add your Generic mode specific API calls in genericService.js
 */
