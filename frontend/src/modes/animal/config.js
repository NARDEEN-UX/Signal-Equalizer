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
  description: 'Control individual instruments inside a musical mix',
  sliderLabels: ['Bass', 'Piano', 'Vocals', 'Violin', 'Others'],
  instrumentTypes: ['Bass', 'Piano', 'Vocals', 'Violin', 'Drums', 'Guitar', 'Flute', 'Trumpet', 'Others'],
  bands: [
    { id: 'music-0', name: 'Bass', low: 20, high: 250, gain: 1.0 },
    { id: 'music-1', name: 'Piano', low: 27, high: 4186, gain: 1.0 },
    { id: 'music-2', name: 'Vocals', low: 80, high: 8000, gain: 1.0 },
    { id: 'music-3', name: 'Violin', low: 196, high: 3520, gain: 1.0 },
    { id: 'music-4', name: 'Others', low: 20, high: 20000, gain: 1.0 }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100
};

// Animal Mode Configuration - 5 BANDS (UPDATED - Scientifically Accurate)
export const ANIMAL_MODE_CONFIG = {
  id: 'animals',
  name: 'Animal Sounds',
  description: 'Adjust different animal sounds with scientifically accurate frequency ranges',
  sliderLabels: ['Songbirds', 'Canines', 'Felines', 'Large Mammals', 'Insects'],
  animalTypes: [
    // Songbirds
    'Sparrow', 'Canary', 'Warbler', 'Finch', 'Crow', 'Owl', 'Eagle',
    // Canines
    'Dog', 'Wolf', 'Hyena', 'Fox', 'Jackal',
    // Felines
    'Cat', 'Lion', 'Tiger', 'Leopard', 'Cheetah',
    // Large Mammals
    'Elephant', 'Whale', 'Horse', 'Cattle', 'Sheep',
    // Insects
    'Cricket', 'Cicada', 'Bee', 'Grasshopper', 'Mosquito'
  ],
  bands: [
    { id: 'animal-0', name: 'Songbirds', low: 3000, high: 8000, gain: 1.0, examples: 'Sparrow, Canary, Warbler, Finch', peak: 5000 },
    { id: 'animal-1', name: 'Canines', low: 250, high: 1000, gain: 1.0, examples: 'Dog, Wolf, Hyena, Fox', peak: 500 },
    { id: 'animal-2', name: 'Felines', low: 1000, high: 3000, gain: 1.0, examples: 'Cat, Lion, Tiger, Leopard', peak: 1500 },
    { id: 'animal-3', name: 'Large Mammals', low: 10, high: 250, gain: 1.0, examples: 'Elephant, Whale, Horse, Cattle', peak: 100 },
    { id: 'animal-4', name: 'Insects', low: 8000, high: 20000, gain: 1.0, examples: 'Cricket, Cicada, Bee, Grasshopper', peak: 12000 }
  ],
  wavelet: 'db4',
  waveletLevels: 6,
  sampleRate: 44100,
  frequencyNote: 'Based on scientific bioacoustics research from Cornell Lab of Ornithology and NOAA'
};

// Human Voice Mode Configuration
export const HUMAN_MODE_CONFIG = {
  id: 'human',
  name: 'Human Voices',
  description: 'Manage multiple human voices in a single recording',
  sliderLabels: ['Male Voice', 'Female Voice', 'Young Speaker', 'Old Speaker'],
  voiceTypes: ['Male', 'Female', 'Young', 'Old', 'Baritone', 'Soprano'],
  bands: [
    { id: 'human-0', name: 'Voice 1', low: 80, high: 8000, gain: 1.0 },
    { id: 'human-1', name: 'Voice 2', low: 80, high: 8000, gain: 1.0 },
    { id: 'human-2', name: 'Voice 3', low: 80, high: 8000, gain: 1.0 },
    { id: 'human-3', name: 'Voice 4', low: 80, high: 8000, gain: 1.0 }
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