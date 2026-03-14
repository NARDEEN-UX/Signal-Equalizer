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
  sliderLabels: ['Cat', 'Dog', 'Bird', 'Elephant'],
  animalTypes: ['Cat', 'Dog', 'Bird', 'Elephant', 'Lion', 'Sheep', 'Cow', 'Horse', 'Monkey', 'Frog'],
  freqBands: [
    { min: 50, max: 10000, label: 'Cat' },
    { min: 40, max: 8000, label: 'Dog' },
    { min: 200, max: 8000, label: 'Bird' },
    { min: 10, max: 5000, label: 'Elephant' }
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
