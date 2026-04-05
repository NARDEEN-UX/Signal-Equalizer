/**
 * Mode Wavelet Configuration
 * Provides band definitions for each mode from backend settings or defaults
 */

// Default band configurations for each mode
const DEFAULT_MODE_BANDS = {
  generic: [
    { id: 'b1', name: 'Band 1', low: 80, high: 180, gain: 1.0 },
    { id: 'b2', name: 'Band 2', low: 180, high: 300, gain: 1.0 },
    { id: 'b3', name: 'Band 3', low: 300, high: 3000, gain: 1.0 },
    { id: 'b4', name: 'Band 4', low: 3000, high: 8000, gain: 1.0 }
  ],
  music: [
    { id: 'music-0', name: 'drums', low: 20, high: 500, gain: 1.0 },
    { id: 'music-1', name: 'bass', low: 30, high: 300, gain: 1.0 },
    { id: 'music-2', name: 'guitar', low: 80, high: 1200, gain: 1.0 },
    { id: 'music-3', name: 'piano', low: 28, high: 4186, gain: 1.0 },
    { id: 'music-4', name: 'vocals', low: 85, high: 3400, gain: 1.0 },
    { id: 'music-5', name: 'other', low: 200, high: 8000, gain: 1.0 }
  ],
  animal: [
    { id: 'animal-0', name: 'Frog', low: 1084.5, high: 2509.3, gain: 1.0 },
    { id: 'animal-1', name: 'Birds', low: 3018.2, high: 5203.4, gain: 1.0 },
    { id: 'animal-2', name: 'Dog', low: 479.6, high: 2314.9, gain: 1.0 },
    { id: 'animal-3', name: 'Cat', low: 708.0, high: 3620.9, gain: 1.0 }
  ],
  animals: [
    { id: 'animal-0', name: 'Frog', low: 1084.5, high: 2509.3, gain: 1.0 },
    { id: 'animal-1', name: 'Birds', low: 3018.2, high: 5203.4, gain: 1.0 },
    { id: 'animal-2', name: 'Dog', low: 479.6, high: 2314.9, gain: 1.0 },
    { id: 'animal-3', name: 'Cat', low: 708.0, high: 3620.9, gain: 1.0 }
  ],
  human: [
    { id: 'human-0', name: 'Children Voices', low: 220, high: 600, gain: 1.0 },
    { id: 'human-1', name: 'French Audio', low: 128.12, high: 685.94, gain: 1.0 },
    { id: 'human-2', name: 'Spanish Audio', low: 128.12, high: 1792.19, gain: 1.0 },
    { id: 'human-3', name: 'Female', low: 205.96, high: 1444.01, gain: 1.0 },
    { id: 'human-4', name: 'Male', low: 112.08, high: 1322.75, gain: 1.0 }
  ],
  humans: [
    { id: 'human-0', name: 'Children Voices', low: 220, high: 600, gain: 1.0 },
    { id: 'human-1', name: 'French Audio', low: 128.12, high: 685.94, gain: 1.0 },
    { id: 'human-2', name: 'Spanish Audio', low: 128.12, high: 1792.19, gain: 1.0 },
    { id: 'human-3', name: 'Female', low: 205.96, high: 1444.01, gain: 1.0 },
    { id: 'human-4', name: 'Male', low: 112.08, high: 1322.75, gain: 1.0 }
  ],
  ecg: [
    { id: 'ecg-0', name: 'Normal', low: 2.2, high: 15.5, gain: 1.0 },
    { id: 'ecg-1', name: 'AFib', low: 0.0, high: 179.4, gain: 1.0 },
    { id: 'ecg-2', name: 'VTach', low: 2.2, high: 3.3, gain: 1.0 },
    { id: 'ecg-3', name: 'HeartBlock', low: 2.2, high: 31.0, gain: 1.0 }
  ]
};

const DEFAULT_SAMPLE_RATES = {
  generic: 44100,
  music: 44100,
  animal: 44100,
  animals: 44100,
  human: 44100,
  humans: 44100,
  ecg: 500
};

/**
 * Get band configuration for a specific mode
 * Returns the band definitions with frequency ranges for that mode
 *
 * @param {string} modeId - Mode identifier ('music', 'animals', 'humans', 'ecg', 'generic')
 * @returns {array} Array of band objects with {id, name, low, high, gain}
 */
export function getModeBands(modeId) {
  const normalizedId = String(modeId || 'generic').toLowerCase().trim();
  const bands = DEFAULT_MODE_BANDS[normalizedId] || DEFAULT_MODE_BANDS.generic;
  return Array.isArray(bands) ? bands : [];
}

/**
 * Get default sample rate for a mode
 * @param {string} modeId - Mode identifier
 * @returns {number} Sample rate in Hz
 */
export function getDefaultSampleRate(modeId) {
  const normalizedId = String(modeId || 'generic').toLowerCase().trim();
  return DEFAULT_SAMPLE_RATES[normalizedId] || 44100;
}

export default {
  getModeBands,
  getDefaultSampleRate,
  DEFAULT_MODE_BANDS
};
