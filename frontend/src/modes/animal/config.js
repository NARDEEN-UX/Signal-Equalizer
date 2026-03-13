/**
 * Animal Mode Configuration
 * Mode-specific settings for Animal Sounds separation
 * 
 * Team member: @animal-mode-dev
 * Backend endpoint: /api/modes/animal
 */

export const ANIMAL_MODE_CONFIG = {
  id: 'animal',
  name: 'Animal Sounds',
  sliderLabels: ['Birds', 'Dogs', 'Cats', 'Others'],
  freqBands: [
    { min: 20, max: 500, label: 'Birds' },
    { min: 500, max: 2000, label: 'Dogs' },
    { min: 2000, max: 8000, label: 'Cats' },
    { min: 8000, max: 16000, label: 'Others' }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100,
  // Backend service will be imported here
};

/**
 * Animal Mode API Service
 * Add your Animal mode specific API calls in animalService.js
 */
