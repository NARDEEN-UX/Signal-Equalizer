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
  sliderLabels: ['Children Voices (Pre-Puberty)', 'French Audio (FLEURS Dataset)', 'Spanish Audio (FLEURS Dataset)', 'All Female Actors (Even Numbers)', 'All Male Actors (Odd Numbers)'],
  voiceTypes: ['Children Voices (Pre-Puberty)', 'French Audio (FLEURS Dataset)', 'Spanish Audio (FLEURS Dataset)', 'All Female Actors (Even Numbers)', 'All Male Actors (Odd Numbers)'],
  freqBands: [
    { min: 220, max: 600, label: 'Children Voices (Pre-Puberty)' },
    { min: 128.12, max: 685.94, label: 'French Audio (FLEURS Dataset)' },
    { min: 128.12, max: 1792.19, label: 'Spanish Audio (FLEURS Dataset)' },
    { min: 205.96, max: 1444.01, label: 'All Female Actors (Even Numbers)' },
    { min: 112.08, max: 1322.75, label: 'All Male Actors (Odd Numbers)' }
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
