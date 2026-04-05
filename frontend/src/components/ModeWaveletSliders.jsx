import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  getAverageGain,
  applyGainToLevels,
  formatFrequency,
  createExclusiveBandToLevelMap
} from '../utils/waveletMath';
import { getModeBands } from '../config/modeWaveletConfig';
import '../styles/WaveletSliders.css';

/**
 * ModeWaveletSliders
 * 
 * Renders dynamic wavelet band sliders that map user-friendly bands to underlying decomposition levels.
 * Each slider represents a frequency band and controls multiple overlapping wavelet levels.
 *
 * Key Features:
 * - Dynamically calculates which wavelet levels overlap with each frequency band
 * - Updates mapping when wavelet type or sample rate changes
 * - Shows band name as slider label with tooltip showing controlled levels
 * - Smooth slider interaction with debounced backend updates
 * - Real-time synchronization with backend wavelet decomposition
 *
 * Props:
 *   @param {string} currentMode - Active mode ID ('music', 'animals', 'humans', 'ecg', 'generic')
 *   @param {string} selectedWavelet - Current wavelet type ('db4', 'db8', 'sym8', 'bior3.5', etc.)
 *   @param {array} waveletSliders - Current wavelet level gain values [L1, L2, L3, ...] (1-based indexing in state, 0-based in array)
 *   @param {number} maxWaveletLevel - Maximum decomposition level (typically 6)
 *   @param {number} sampleRate - Audio sample rate in Hz
 *   @param {function} onChange - Callback when slider changes: onChange(updatedWaveletSliders)
 *   @param {function} onApplyBandGains - Optional callback for backend update: onApplyBandGains({bandId: gain, ...})
 *
 * Example:
 *   <ModeWaveletSliders
 *     currentMode="animals"
 *     selectedWavelet="sym8"
 *     waveletSliders={[1.0, 1.0, 1.0, 1.0, 1.0, 1.0]}
 *     maxWaveletLevel={6}
 *     sampleRate={44100}
 *     onChange={(sliders) => setWaveletSliders(sliders)}
 *   />
 */
const ModeWaveletSliders = ({
  currentMode,
  selectedWavelet,
  waveletSliders = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  maxWaveletLevel = 6,
  sampleRate = 44100,
  onChange,
  onApplyBandGains
}) => {
  // Get band configuration for current mode
  const bands = getModeBands(currentMode);

  if (!bands || bands.length === 0) {
    return (
      <div className="wavelet-sliders-container" style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
        No wavelet bands configured for this mode
      </div>
    );
  }

  const sr = Math.max(1, Number(sampleRate) || 44100);
  const maxLevel = Math.max(1, Math.min(Number(maxWaveletLevel) || 6, 20));
  const wavenet = String(selectedWavelet || 'db4').toLowerCase().trim();

  // Make level ownership exclusive so changing one band slider does not move others,
  // while still guaranteeing every band gets at least one level when possible.
  const bandToLevelMap = useMemo(() => {
    return createExclusiveBandToLevelMap(bands, maxLevel, sr, true, wavenet);
  }, [bands, maxLevel, sr, wavenet]);

  // Local state for smooth slider interaction without blocking on backend
  const [localValues, setLocalValues] = useState(() => {
    return bands.map((band, idx) => {
      const levels = bandToLevelMap[idx] || [];
      return getAverageGain(waveletSliders, levels);
    });
  });

  // Sync local state when external waveletSliders change
  useEffect(() => {
    setLocalValues(
      bands.map((band, idx) => {
        const levels = bandToLevelMap[idx] || [];
        return getAverageGain(waveletSliders, levels);
      })
    );
  }, [waveletSliders, bandToLevelMap, bands.length]);

  // Refs for debouncing backend updates
  const debounceTimerRef = useRef(null);
  const pendingChangesRef = useRef(null);

  /**
   * Handle slider change
   * Updates both local state and underlying wavelet levels
   */
  const handleSliderChange = (bandIndex, newGain) => {
    const gainValue = Number(newGain);
    const clampedGain = Math.max(0, Math.min(2, Number.isFinite(gainValue) ? gainValue : 1));
    
    // Update local display immediately for responsiveness
    setLocalValues(prev => {
      const updated = [...prev];
      updated[bandIndex] = clampedGain;
      return updated;
    });

    // Get levels controlled by this band
    const controlledLevels = bandToLevelMap[bandIndex] || [];
    
    // Apply gain to the wavelet sliders array
    const updatedWaveletSliders = applyGainToLevels(waveletSliders, controlledLevels, clampedGain);
    
    // Store pending changes for debounced backend update
    pendingChangesRef.current = {
      updatedSliders: updatedWaveletSliders,
      bandIndex,
      bandId: bands[bandIndex]?.id,
      gain: clampedGain
    };

    // Notify parent component immediately (for audio processing)
    if (onChange) {
      onChange(updatedWaveletSliders);
    }

    // Debounce backend update (500ms)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (pendingChangesRef.current && onApplyBandGains) {
        // Notify backend of band gain change
        onApplyBandGains({
          mode: currentMode,
          bandId: pendingChangesRef.current.bandId,
          bandIndex: pendingChangesRef.current.bandIndex,
          gain: pendingChangesRef.current.gain,
          allGains: pendingChangesRef.current.updatedSliders
        });
      }
      debounceTimerRef.current = null;
    }, 500);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Format controlled levels for tooltip
   * Example: [4, 5] → "L4, L5"
   */
  const formatControlledLevels = (levelIndices) => {
    if (!Array.isArray(levelIndices) || levelIndices.length === 0) {
      return 'No levels';
    }
    return levelIndices.map(l => `L${l}`).join(', ');
  };

  /**
   * Format frequency range for band label
   */
  const formatBandFrequency = (band) => {
    return `${formatFrequency(band.low)} - ${formatFrequency(band.high)}`;
  };

  return (
    <div className="wavelet-sliders-container">
      <div className="wavelet-sliders-header">
        <h3>Wavelet Band Equalizer</h3>
        <p className="wavelet-info">
          Wavelet: <strong>{wavenet.toUpperCase()}</strong> | 
          Levels: <strong>L1-L{maxLevel}</strong> | 
          Sample Rate: <strong>{sr.toLocaleString()} Hz</strong>
        </p>
      </div>

      <div className="wavelet-bands-grid">
        {bands.map((band, bandIndex) => {
          const controlledLevels = bandToLevelMap[bandIndex] || [];
          const gainValue = Number(localValues[bandIndex]);
          const currentGain = Number.isFinite(gainValue) ? gainValue : 1.0;
          const freqRange = formatBandFrequency(band);
          const levelInfo = formatControlledLevels(controlledLevels);

          return (
            <div key={band.id} className="wavelet-band-slider-group">
              <div className="wavelet-band-header">
                <label className="wavelet-band-name">{band.name}</label>
                <span className="wavelet-band-frequency" title={levelInfo}>
                  {freqRange}
                </span>
              </div>

              <div className="wavelet-band-control">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={currentGain}
                  onChange={(e) => handleSliderChange(bandIndex, parseFloat(e.target.value))}
                  className="wavelet-band-slider"
                  title={`Controls: ${levelInfo}`}
                />
                <span className="wavelet-gain-value">
                  {currentGain.toFixed(2)}x
                </span>
              </div>

              <div className="wavelet-band-levels-indicator">
                <small>Controls: {levelInfo}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModeWaveletSliders;
