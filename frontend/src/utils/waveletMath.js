/**
 * Wavelet Mathematics Utilities
 * Handles dyadic frequency decomposition and level-to-band mapping
 */

/**
 * Wavelet decomposition filter lengths (used to estimate maximum decomposition depth)
 * Higher value = fewer possible decomposition levels
 */
const WAVELET_DEC_LEN = {
  haar: 2,
  db4: 8,
  db6: 12,
  db8: 16,
  sym5: 10,
  sym8: 16,
  coif3: 18,
  'bior3.5': 12,
  dmey: 62
};

// Approximate basis-dependent spectral response skew used for UI band mapping.
// This makes level ownership react when users switch wavelet families.
const WAVELET_RESPONSE_SKEW = {
  haar: 1.12,
  db4: 1.0,
  db6: 0.97,
  db8: 0.94,
  sym5: 1.03,
  sym8: 1.01,
  coif3: 0.99,
  'bior3.5': 1.06,
  dmey: 0.92
};

const normalizeWaveletKey = (waveletName = 'db4') => {
  const key = String(waveletName || 'db4').trim().toLowerCase();
  if (key === 'biorthogonal3.5' || key === 'bior35') return 'bior3.5';
  return WAVELET_DEC_LEN[key] ? key : 'db4';
};

/**
 * Estimate effective per-level frequency range for a specific basis.
 * Uses dyadic bands as base, then applies a small basis-dependent skew/transition spread.
 */
export function getEffectiveLevelFrequencyRange(level, sampleRate, waveletName = 'db4') {
  const base = getLevelFrequencyRange(level, sampleRate);
  const waveletKey = normalizeWaveletKey(waveletName);
  const decLen = WAVELET_DEC_LEN[waveletKey] || WAVELET_DEC_LEN.db4;
  const skew = WAVELET_RESPONSE_SKEW[waveletKey] || 1.0;

  const center = ((base.low + base.high) / 2) * skew;
  const half = (base.high - base.low) / 2;

  // Longer filters get slightly wider transition region in this UI approximation.
  const spread = 1 + Math.min(0.35, Math.max(0, (decLen - 8) / 80));
  const low = Math.max(0, center - half * spread);
  const high = Math.max(low + 1e-9, center + half * spread);

  return { low, high };
}

/**
 * Calculate the frequency range [low, high] for a specific wavelet decomposition level
 * Uses dyadic (power-of-2) decomposition: L1 covers sr/2 to sr/4, L2 covers sr/4 to sr/8, etc.
 *
 * @param {number} level - Decomposition level (1-based: L1, L2, L3, ...)
 * @param {number} sampleRate - Audio sample rate in Hz
 * @returns {object} { low: number, high: number } - Frequency range in Hz
 *
 * Example with 44100 Hz sample rate (Nyquist = 22050 Hz):
 *   L1: { low: 11025, high: 22050 }  (sr/4 to sr/2)
 *   L2: { low: 5512.5, high: 11025 } (sr/8 to sr/4)
 *   L3: { low: 2756.25, high: 5512.5 }
 */
export function getLevelFrequencyRange(level, sampleRate) {
  const sr = Math.max(1, Number(sampleRate) || 44100);
  const levelNum = Math.max(1, Number(level) || 1);
  
  const high = sr / (2 ** levelNum);        // e.g., sr/2 for L1, sr/4 for L2
  const low = sr / (2 ** (levelNum + 1));   // e.g., sr/4 for L1, sr/8 for L2
  
  return { low, high };
}

/**
 * Check if a wavelet level's frequency range overlaps with a band's frequency range
 * Ranges overlap if: level.low < band.high AND level.high > band.low
 *
 * @param {number} level - Wavelet decomposition level
 * @param {number} bandLow - Band's lower frequency bound (Hz)
 * @param {number} bandHigh - Band's upper frequency bound (Hz)
 * @param {number} sampleRate - Audio sample rate (Hz)
 * @returns {boolean} True if the level overlaps with the band
 */
export function levelOverlapsWithBand(level, bandLow, bandHigh, sampleRate, waveletName = 'db4') {
  const { low: levelLow, high: levelHigh } = getEffectiveLevelFrequencyRange(level, sampleRate, waveletName);
  return levelLow < bandHigh && levelHigh > bandLow;
}

/**
 * Get all wavelet levels that intersect with a band's frequency range
 *
 * @param {number} bandLow - Band's lower frequency bound (Hz)
 * @param {number} bandHigh - Band's upper frequency bound (Hz)
 * @param {number} maxWaveletLevel - Maximum decomposition level available
 * @param {number} sampleRate - Audio sample rate (Hz)
 * @returns {array} Array of level numbers [L1, L2, L3, ...] that overlap with the band
 *
 * Example:
 *   getLevelsForBand(1084.5, 2509.3, 6, 44100)
 *   → [4, 5]  (L4 and L5 overlap with Frog band)
 */
export function getLevelsForBand(bandLow, bandHigh, maxWaveletLevel, sampleRate, waveletName = 'db4') {
  const overlappingLevels = [];
  const maxLevel = Math.max(1, Math.min(Number(maxWaveletLevel) || 6, 20));
  
  for (let level = 1; level <= maxLevel; level++) {
    if (levelOverlapsWithBand(level, bandLow, bandHigh, sampleRate, waveletName)) {
      overlappingLevels.push(level);
    }
  }
  
  return overlappingLevels;
}

/**
 * Calculate the maximum decomposition level based on signal length and wavelet type
 * Longer wavelets (more coefficients) support fewer decomposition levels
 *
 * @param {number} signalLength - Input signal sample count
 * @param {string} waveletName - Wavelet type (e.g., 'sym8', 'db4', 'bior3.5')
 * @param {number} fallback - Default level if signal unavailable (default: 6)
 * @returns {number} Maximum decomposition level
 *
 * Example:
 *   computeMaxWaveletLevel(44100, 'sym8', 6) → 6
 *   computeMaxWaveletLevel(22050, 'db8', 6) → 5
 */
export function computeMaxWaveletLevel(signalLength, waveletName, fallback = 6) {
  const n = Number(signalLength);
  const waveletKey = String(waveletName || 'db4').toLowerCase();
  const decLen = WAVELET_DEC_LEN[waveletKey] || WAVELET_DEC_LEN.db4;

  // If no signal or very small signal, calculate a reasonable default based on wavelet
  if (!Number.isFinite(n) || n < 2) {
    // Use decomposition length to estimate: shorter wavelet = more levels possible
    return Math.max(1, fallback - Math.floor(decLen / 8));
  }

  const denom = Math.max(1, decLen - 1);
  const ratio = n / denom;
  if (ratio <= 1) return 1;

  return Math.max(1, Math.floor(Math.log2(ratio)));
}

/**
 * Normalize wavelet slider array to match a specified number of levels
 * Pads with 1.0 (unity gain) if too short, truncates if too long
 *
 * @param {array} sliders - Current wavelet slider values [L1_gain, L2_gain, ...]
 * @param {number} targetLevelCount - Desired number of levels
 * @returns {array} Normalized slider array with exactly targetLevelCount elements
 */
export function normalizeWaveletSliders(sliders, targetLevelCount) {
  const defaults = Array.from({ length: targetLevelCount }, () => 1.0);
  
  if (!Array.isArray(sliders) || sliders.length === 0) {
    return defaults;
  }

  return defaults.map((defaultVal, idx) => {
    const val = Number(sliders[idx]);
    // Clamp to 0-2 range (0 = silence, 1 = unity, 2 = double)
    return Number.isFinite(val) ? Math.max(0, Math.min(2, val)) : defaultVal;
  });
}

/**
 * Create a mapping from each band to its overlapping wavelet levels
 * Used for quickly determining which levels to update when a band slider changes
 *
 * @param {array} bands - Band configuration array [ { id, name, low, high, gain }, ... ]
 * @param {number} maxWaveletLevel - Maximum decomposition level
 * @param {number} sampleRate - Audio sample rate (Hz)
 * @returns {object} Map of bandIndex → [levelNumbers]
 *
 * Example:
 *   createBandToLevelMap([
 *     { id: 'b0', name: 'Frog', low: 1084.5, high: 2509.3 },
 *     { id: 'b1', name: 'Birds', low: 3018.2, high: 5203.4 }
 *   ], 6, 44100)
 *   → { 0: [4, 5], 1: [3, 4] }
 */
export function createBandToLevelMap(bands, maxWaveletLevel, sampleRate, waveletName = 'db4') {
  const map = {};
  
  if (!Array.isArray(bands)) return map;
  
  bands.forEach((band, bandIdx) => {
    if (Number.isFinite(band.low) && Number.isFinite(band.high)) {
      map[bandIdx] = getLevelsForBand(band.low, band.high, maxWaveletLevel, sampleRate, waveletName);
    }
  });
  
  return map;
}

/**
 * Create an exclusive band-to-level mapping where each level belongs to one band.
 * If ensureCoverage=true, tries to guarantee each band owns at least one level when feasible.
 *
 * @param {array} bands - Band configuration array
 * @param {number} maxWaveletLevel - Maximum decomposition level
 * @param {number} sampleRate - Audio sample rate (Hz)
 * @param {boolean} ensureCoverage - Attempt to give each band >=1 level
 * @returns {object} Map of bandIndex → [levelNumbers]
 */
export function createExclusiveBandToLevelMap(bands, maxWaveletLevel, sampleRate, ensureCoverage = true, waveletName = 'db4') {
  const safeBands = Array.isArray(bands) ? bands : [];
  const maxLevel = Math.max(1, Math.min(Number(maxWaveletLevel) || 6, 20));
  const sr = Math.max(1, Number(sampleRate) || 44100);

  const rawMap = createBandToLevelMap(safeBands, maxLevel, sr, waveletName);
  const exclusive = {};
  const owners = {};

  safeBands.forEach((_, idx) => {
    exclusive[idx] = [];
  });

  const bandCenter = (band) => {
    const low = Number(band?.low) || 0;
    const high = Number(band?.high);
    const hi = Number.isFinite(high) ? high : low;
    return (low + hi) / 2;
  };

  // First pass: assign each overlapping level to the nearest band center.
  for (let level = 1; level <= maxLevel; level += 1) {
    const levelRange = getEffectiveLevelFrequencyRange(level, sr, waveletName);
    const levelCenter = (Number(levelRange.low) + Number(levelRange.high)) / 2;

    let owner = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let bandIdx = 0; bandIdx < safeBands.length; bandIdx += 1) {
      const levels = rawMap[bandIdx] || [];
      if (!levels.includes(level)) continue;

      const distance = Math.abs(levelCenter - bandCenter(safeBands[bandIdx]));
      if (distance < bestDistance) {
        bestDistance = distance;
        owner = bandIdx;
      }
    }

    if (owner !== null) {
      owners[level] = owner;
      exclusive[owner].push(level);
    }
  }

  if (!ensureCoverage || safeBands.length === 0) {
    return exclusive;
  }

  // Second pass: ensure empty bands receive a level by reassigning nearest candidates.
  const levelsPool = Array.from({ length: maxLevel }, (_, i) => i + 1);

  for (let bandIdx = 0; bandIdx < safeBands.length; bandIdx += 1) {
    if ((exclusive[bandIdx] || []).length > 0) continue;

    const targetCenter = bandCenter(safeBands[bandIdx]);
    const sortedLevels = [...levelsPool].sort((a, b) => {
      const aEffective = getEffectiveLevelFrequencyRange(a, sr, waveletName);
      const bEffective = getEffectiveLevelFrequencyRange(b, sr, waveletName);
      const aDist = Math.abs(((aEffective.low + aEffective.high) / 2) - targetCenter);
      const bDist = Math.abs(((bEffective.low + bEffective.high) / 2) - targetCenter);
      return aDist - bDist;
    });

    let chosenLevel = null;

    // Prefer stealing from owners that still keep at least one level.
    for (let i = 0; i < sortedLevels.length; i += 1) {
      const lv = sortedLevels[i];
      const currentOwner = owners[lv];
      if (currentOwner === undefined || currentOwner === bandIdx) {
        chosenLevel = lv;
        break;
      }
      if ((exclusive[currentOwner] || []).length > 1) {
        chosenLevel = lv;
        break;
      }
    }

    // Fallback: take nearest level even if this empties another band.
    if (chosenLevel === null && sortedLevels.length > 0) {
      chosenLevel = sortedLevels[0];
    }

    if (chosenLevel !== null) {
      const prevOwner = owners[chosenLevel];
      if (prevOwner !== undefined && prevOwner !== bandIdx) {
        exclusive[prevOwner] = (exclusive[prevOwner] || []).filter((lv) => lv !== chosenLevel);
      }
      owners[chosenLevel] = bandIdx;
      if (!(exclusive[bandIdx] || []).includes(chosenLevel)) {
        exclusive[bandIdx].push(chosenLevel);
      }
    }
  }

  // Keep levels sorted for stable UI labels.
  Object.keys(exclusive).forEach((k) => {
    exclusive[k] = (exclusive[k] || []).slice().sort((a, b) => a - b);
  });

  return exclusive;
}

/**
 * Apply a gain value to specific wavelet levels in a slider array
 * Used when a user moves a band slider to update all underlying levels
 *
 * @param {array} currentSliders - Current wavelet slider values
 * @param {array} levelIndices - Levels to modify (0-based: [3, 4] for L4, L5)
 * @param {number} gain - New gain value (0-2)
 * @returns {array} Updated slider array
 *
 * Example:
 *   applyGainToLevels([1, 1, 1, 1, 1, 1], [3, 4], 1.5)
 *   → [1, 1, 1, 1.5, 1.5, 1]
 */
export function applyGainToLevels(currentSliders, levelIndices, gain) {
  const updated = [...(Array.isArray(currentSliders) ? currentSliders : [])];
  const gainValue = Number(gain);
  const clampedGain = Math.max(0, Math.min(2, Number.isFinite(gainValue) ? gainValue : 1));
  
  if (Array.isArray(levelIndices)) {
    levelIndices.forEach(levelIdx => {
      const idx = Number(levelIdx) - 1; // Convert to 0-based
      if (idx >= 0 && idx < updated.length) {
        updated[idx] = clampedGain;
      }
    });
  }
  
  return updated;
}

/**
 * Get average gain across multiple levels
 * Used to display current slider position when multiple levels are grouped
 *
 * @param {array} sliders - Current wavelet slider values
 * @param {array} levelIndices - Levels to average (0-based)
 * @returns {number} Average gain value (0-2)
 */
export function getAverageGain(sliders, levelIndices) {
  if (!Array.isArray(levelIndices) || levelIndices.length === 0) return 1.0;
  
  const gains = levelIndices.map(levelIdx => {
    const idx = Number(levelIdx) - 1; // Convert to 0-based
    if (idx >= 0 && idx < sliders.length) {
      const n = Number(sliders[idx]);
      return Number.isFinite(n) ? n : 1.0;
    }
    return 1.0;
  });
  
  return gains.reduce((sum, g) => sum + g, 0) / gains.length;
}

/**
 * Format a frequency value for display
 * Shows Hz for low frequencies, kHz for high frequencies
 *
 * @param {number} freq - Frequency in Hz
 * @returns {string} Formatted frequency string
 *
 * Example:
 *   formatFrequency(1250) → "1250 Hz"
 *   formatFrequency(11025) → "11.03 kHz"
 */
export function formatFrequency(freq) {
  const f = Number(freq);
  if (!Number.isFinite(f)) return '0 Hz';
  
  if (f >= 1000) {
    return `${(f / 1000).toFixed(2)} kHz`;
  }
  return `${Math.round(f)} Hz`;
}

export default {
  getLevelFrequencyRange,
  getEffectiveLevelFrequencyRange,
  levelOverlapsWithBand,
  getLevelsForBand,
  computeMaxWaveletLevel,
  normalizeWaveletSliders,
  createBandToLevelMap,
  createExclusiveBandToLevelMap,
  applyGainToLevels,
  getAverageGain,
  formatFrequency
};
