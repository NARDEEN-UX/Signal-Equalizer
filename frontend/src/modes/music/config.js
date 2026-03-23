/**
 * Signal Processing Mode Configuration
 * Unified configuration system supporting all modes: generic, music, animal, human, ecg
 * 
 * Each mode can load its band configuration from a JSON file (e.g., music_default.json)
 * Band structure: { id: string, name: string, low: number, high: number, gain: number }
 */

// Music Mode Configuration
export const MUSIC_MODE_CONFIG = {
  id: 'music',
  name: 'Musical Instruments',
  description: 'Control Demucs stems inside a musical mix',
  sliderLabels: ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other'],
  instrumentTypes: ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other'],
  bands: [
    { id: 'music-0', name: 'drums', low: 20, high: 12000, gain: 1.0 },
    { id: 'music-1', name: 'bass', low: 20, high: 300, gain: 1.0 },
    { id: 'music-2', name: 'vocals', low: 80, high: 8000, gain: 1.0 },
    { id: 'music-3', name: 'guitar', low: 80, high: 5000, gain: 1.0 },
    { id: 'music-4', name: 'piano', low: 27, high: 5000, gain: 1.0 },
    { id: 'music-5', name: 'other', low: 20, high: 20000, gain: 1.0 }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100
};

// Animal Mode Configuration - 5 BANDS (Scientifically Accurate)
export const ANIMAL_MODE_CONFIG = {
  id: 'animal',
  name: 'Animal Sounds',
  description: 'Adjust different animal sounds with scientifically accurate frequency ranges',
  sliderLabels: ['Songbirds', 'Canines', 'Felines', 'Large Mammals', 'Insects'],
  animalTypes: [
    'Sparrow', 'Canary', 'Warbler', 'Finch', 'Crow', 'Owl', 'Eagle',
    'Dog', 'Wolf', 'Hyena', 'Fox', 'Jackal',
    'Cat', 'Lion', 'Tiger', 'Leopard', 'Cheetah',
    'Elephant', 'Whale', 'Horse', 'Cattle', 'Sheep',
    'Cricket', 'Cicada', 'Bee', 'Grasshopper', 'Mosquito'
  ],
  bands: [
    { id: 'animal-0', name: 'Songbirds', low: 1000, high: 8000, gain: 1.0, examples: 'Sparrow, Canary, Warbler, Finch', peak: 5000 },
    { id: 'animal-1', name: 'Canines', low: 150, high: 2000, gain: 1.0, examples: 'Dog, Wolf, Hyena, Fox', peak: 500 },
    { id: 'animal-2', name: 'Felines', low: 48, high: 10000, gain: 1.0, examples: 'Cat, Lion, Tiger, Leopard', peak: 1500 },
    { id: 'animal-3', name: 'Large Mammals', low: 5, high: 500, gain: 1.0, examples: 'Elephant, Whale, Horse, Cattle', peak: 100 },
    { id: 'animal-4', name: 'Insects', low: 600, high: 20000, gain: 1.0, examples: 'Cricket, Cicada, Bee, Grasshopper', peak: 12000 }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100
};

// Human Voice Mode Configuration
export const HUMAN_MODE_CONFIG = {
  id: 'human',
  name: 'Human Voices',
  description: 'Manage multiple human voices in a single recording',
  sliderLabels: ['Male Old', 'Male Young', 'Female Old', 'Female Young'],
  voiceTypes: ['Male Old', 'Male Young', 'Female Old', 'Female Young'],
  bands: [
    { id: 'human-0', name: 'Male Old', low: 85, high: 120, gain: 1.0 },
    { id: 'human-1', name: 'Male Young', low: 120, high: 180, gain: 1.0 },
    { id: 'human-2', name: 'Female Old', low: 150, high: 220, gain: 1.0 },
    { id: 'human-3', name: 'Female Young', low: 200, high: 300, gain: 1.0 }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100
};

// ECG Mode Configuration
export const ECG_MODE_CONFIG = {
  id: 'ecg',
  name: 'ECG Abnormalities',
  description: 'Control magnitude of arrhythmia components (normal + 3 types)',
  sliderLabels: ['Normal', 'Arrhythmia 1', 'Arrhythmia 2', 'Arrhythmia 3'],
  arrhythmiaTypes: ['Normal', 'Atrial Fibrillation', 'Ventricular Tachycardia', 'Heart Block'],
  bands: [
    { id: 'ecg-0', name: 'Normal', low: 0.5, high: 45, gain: 1.0 },
    { id: 'ecg-1', name: 'Arrhythmia 1', low: 0.5, high: 45, gain: 1.0 },
    { id: 'ecg-2', name: 'Arrhythmia 2', low: 0.5, high: 45, gain: 1.0 },
    { id: 'ecg-3', name: 'Arrhythmia 3', low: 0.5, high: 45, gain: 1.0 }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 1000 // ECG typically sampled at 1000 Hz
};

// Generic Mode Configuration
export const GENERIC_MODE_CONFIG = {
  id: 'generic',
  name: 'Generic Mode',
  description: 'Customize frequency subdivisions with precise equalizer controls',
  sliderLabels: ['Band 1', 'Band 2', 'Band 3', 'Band 4'],
  bands: [
    { id: 'b1', name: 'Band 1', low: 80, high: 180, gain: 1.0 },
    { id: 'b2', name: 'Band 2', low: 180, high: 300, gain: 1.0 },
    { id: 'b3', name: 'Band 3', low: 300, high: 3000, gain: 1.0 },
    { id: 'b4', name: 'Band 4', low: 3000, high: 8000, gain: 1.0 }
  ],
  wavelet: 'haar',
  waveletLevels: 6,
  sampleRate: 44100,
  allowAddSubdivision: true // Only generic mode allows adding new bands
};

/**
 * Get configuration for a specific mode
 * @param {string} modeId - The mode identifier
 * @returns {Object} Configuration object for the mode
 */
export const getModeConfig = (modeId) => {
  const configs = {
    generic: GENERIC_MODE_CONFIG,
    music: MUSIC_MODE_CONFIG,
    animal: ANIMAL_MODE_CONFIG,
    human: HUMAN_MODE_CONFIG,
    ecg: ECG_MODE_CONFIG
  };
  return configs[modeId] || GENERIC_MODE_CONFIG;
};

/**
 * Get default bands for a mode
 * @param {string} modeId - The mode identifier
 * @returns {Array} Array of band objects
 */
export const getModeBands = (modeId) => {
  const config = getModeConfig(modeId);
  return config.bands || [];
};

/**
 * Validate band configuration
 * @param {Array} bands - Array of band objects
 * @returns {boolean} True if valid
 */
export const validateBands = (bands) => {
  if (!Array.isArray(bands)) return false;
  return bands.every(band => 
    band.id && 
    band.name && 
    typeof band.low === 'number' && 
    typeof band.high === 'number' && 
    typeof band.gain === 'number'
  );
};

/**
 * Normalize band configuration
 * @param {Array} bands - Array of band objects
 * @returns {Array} Normalized bands
 */
export const normalizeBands = (bands) => {
  if (!Array.isArray(bands)) return [];
  return bands.map((band, i) => ({
    id: String(band.id || `band-${i}`),
    name: String(band.name || `Band ${i + 1}`),
    low: Number(band.low) || 0,
    high: Number(band.high) || 1,
    gain: Number(band.gain) ?? 1.0
  }));
};

export default {
  MUSIC_MODE_CONFIG,
  ANIMAL_MODE_CONFIG,
  HUMAN_MODE_CONFIG,
  ECG_MODE_CONFIG,
  GENERIC_MODE_CONFIG,
  getModeConfig,
  getModeBands,
  validateBands,
  normalizeBands
};
